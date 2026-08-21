import { groupsService } from "../groups/groups.service.js";
import { peopleService } from "../people/people.service.js";
import { tournamentsRepository } from "./tournaments.repository.js";

const STATUSES = new Set(["draft", "group_stage", "knockout", "completed", "cancelled"]);
const KNOCKOUT_STARTS = new Set(["quarterfinal", "semifinal", "final"]);
const BEST_OF_VALUES = new Set([1, 3, 5]);

function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function cleanText(value, maxLength = 500) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maxLength) throw httpError(`Nội dung không được vượt quá ${maxLength} ký tự.`);
  return text;
}

function scoreTotals(scores = []) {
  return scores.reduce((total, score) => ({
    team1: total.team1 + Number(score.team1 || 0),
    team2: total.team2 + Number(score.team2 || 0),
  }), { team1: 0, team2: 0 });
}

function headToHead(left, right, matches) {
  const direct = matches.find((match) =>
    match.status === "completed" && (
      (match.team1_id === left.team_id && match.team2_id === right.team_id) ||
      (match.team1_id === right.team_id && match.team2_id === left.team_id)
    ));
  if (!direct?.winner_team_id) return 0;
  return direct.winner_team_id === left.team_id ? -1 : 1;
}

function buildStandings(group, placements, matches, teamById) {
  const groupMatches = matches.filter((match) => match.stage === "group" && match.group_id === group.id);
  const rows = placements
    .filter((placement) => placement.group_id === group.id)
    .map((placement) => ({
      team_id: placement.team_id,
      team: teamById.get(placement.team_id),
      position: placement.position,
      played: 0,
      wins: 0,
      losses: 0,
      sets_for: 0,
      sets_against: 0,
      points_for: 0,
      points_against: 0,
      standing_points: 0,
    }));
  const rowByTeam = new Map(rows.map((row) => [row.team_id, row]));

  for (const match of groupMatches) {
    if (match.status !== "completed" || !match.winner_team_id) continue;
    const left = rowByTeam.get(match.team1_id);
    const right = rowByTeam.get(match.team2_id);
    if (!left || !right) continue;
    const totals = scoreTotals(match.set_scores);
    left.played += 1;
    right.played += 1;
    left.sets_for += Number(match.team1_sets || 0);
    left.sets_against += Number(match.team2_sets || 0);
    right.sets_for += Number(match.team2_sets || 0);
    right.sets_against += Number(match.team1_sets || 0);
    left.points_for += totals.team1;
    left.points_against += totals.team2;
    right.points_for += totals.team2;
    right.points_against += totals.team1;
    if (match.winner_team_id === left.team_id) {
      left.wins += 1;
      left.standing_points += 3;
      right.losses += 1;
    } else {
      right.wins += 1;
      right.standing_points += 3;
      left.losses += 1;
    }
  }

  rows.sort((left, right) => {
    const ordered = [
      right.standing_points - left.standing_points,
      right.wins - left.wins,
      (right.sets_for - right.sets_against) - (left.sets_for - left.sets_against),
      (right.points_for - right.points_against) - (left.points_for - left.points_against),
    ].find((value) => value !== 0);
    if (ordered) return ordered;
    const direct = headToHead(left, right, groupMatches);
    if (direct) return direct;
    return (left.team?.seed || 9999) - (right.team?.seed || 9999) ||
      (left.team?.name || "").localeCompare(right.team?.name || "", "vi");
  });

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    qualified: index < 2,
    set_difference: row.sets_for - row.sets_against,
    point_difference: row.points_for - row.points_against,
  }));
}

function normalizeTournament(base, teams, members, groups, placements, matches) {
  const membersByTeam = new Map();
  for (const member of members) {
    const list = membersByTeam.get(member.team_id) || [];
    list.push(member);
    membersByTeam.set(member.team_id, list);
  }
  const normalizedTeams = teams.map((team) => ({
    ...team,
    members: (membersByTeam.get(team.id) || []).sort((a, b) => a.member_slot - b.member_slot),
  }));
  const teamById = new Map(normalizedTeams.map((team) => [team.id, team]));
  const normalizedMatches = matches.map((match) => ({
    ...match,
    team1: teamById.get(match.team1_id) || null,
    team2: teamById.get(match.team2_id) || null,
    winner_team: teamById.get(match.winner_team_id) || null,
  }));
  const normalizedGroups = groups.map((group) => ({
    ...group,
    standings: buildStandings(group, placements, normalizedMatches, teamById),
    matches: normalizedMatches.filter((match) => match.stage === "group" && match.group_id === group.id),
  }));

  return {
    ...base,
    champion_team: teamById.get(base.champion_team_id) || null,
    teams: normalizedTeams,
    groups: normalizedGroups,
    matches: normalizedMatches,
  };
}

function naturalQualifierSlots(groups) {
  const first = groups.map((group) => group.standings[0]).filter(Boolean);
  const second = groups.map((group) => group.standings[1]).filter(Boolean);
  const source = (row, label) => row ? ({ team_id: row.team_id, source: label }) : null;

  if (groups.length === 1) {
    return [source(first[0], "Nhất bảng A"), source(second[0], "Nhì bảng A")];
  }
  if (groups.length === 2) {
    return [
      source(first[0], "Nhất bảng A"), source(second[1], "Nhì bảng B"),
      source(first[1], "Nhất bảng B"), source(second[0], "Nhì bảng A"),
    ];
  }
  if (groups.length === 3) {
    return [
      source(first[0], "Nhất bảng A"), null,
      source(first[2], "Nhất bảng C"), source(second[1], "Nhì bảng B"),
      source(first[1], "Nhất bảng B"), null,
      source(second[0], "Nhì bảng A"), source(second[2], "Nhì bảng C"),
    ];
  }
  return [
    source(first[0], "Nhất bảng A"), source(second[1], "Nhì bảng B"),
    source(first[2], "Nhất bảng C"), source(second[3], "Nhì bảng D"),
    source(first[1], "Nhất bảng B"), source(second[0], "Nhì bảng A"),
    source(first[3], "Nhất bảng D"), source(second[2], "Nhì bảng C"),
  ];
}

function stageCapacity(stage) {
  return stage === "quarterfinal" ? 8 : stage === "semifinal" ? 4 : 2;
}

function expandSlots(slots, capacity) {
  let expanded = [...slots];
  while (expanded.length < capacity) expanded = expanded.flatMap((slot) => [slot, null]);
  return expanded;
}

function buildKnockoutMatches(tournament) {
  const capacity = stageCapacity(tournament.knockout_start);
  const natural = naturalQualifierSlots(tournament.groups);
  if (natural.filter(Boolean).length > capacity) {
    throw httpError("Vòng bắt đầu đã chọn không đủ chỗ cho các đội vượt qua vòng bảng.");
  }
  const slots = expandSlots(natural, capacity);
  const firstMatchNumber = Math.max(0, ...tournament.matches.map((match) => match.match_number || 0)) + 1;
  let matchNumber = firstMatchNumber;
  const definitions = [];
  const stageConfig = tournament.knockout_start === "quarterfinal"
    ? [
        { stage: "quarterfinal", key: "QF", count: 4, next: "SF" },
        { stage: "semifinal", key: "SF", count: 2, next: "F" },
        { stage: "final", key: "F", count: 1, next: null },
      ]
    : tournament.knockout_start === "semifinal"
      ? [
          { stage: "semifinal", key: "SF", count: 2, next: "F" },
          { stage: "final", key: "F", count: 1, next: null },
        ]
      : [{ stage: "final", key: "F", count: 1, next: null }];

  for (const level of stageConfig) {
    for (let index = 0; index < level.count; index += 1) {
      const isFirstLevel = level.stage === tournament.knockout_start;
      const team1 = isFirstLevel ? slots[index * 2] : null;
      const team2 = isFirstLevel ? slots[index * 2 + 1] : null;
      const nextIndex = Math.floor(index / 2) + 1;
      definitions.push({
        key: `${level.key}${index + 1}`,
        stage: level.stage,
        position: index + 1,
        match_number: matchNumber,
        team1_id: team1?.team_id || null,
        team2_id: team2?.team_id || null,
        team1_source: isFirstLevel ? team1?.source || null : `Thắng ${level.stage === "final" ? "bán kết" : "tứ kết"} ${index * 2 + 1}`,
        team2_source: isFirstLevel ? team2?.source || null : `Thắng ${level.stage === "final" ? "bán kết" : "tứ kết"} ${index * 2 + 2}`,
        next_key: level.next ? `${level.next}${nextIndex}` : null,
        next_slot: level.next ? (index % 2) + 1 : null,
        loser_next_key: tournament.third_place_enabled && level.stage === "semifinal" ? "TP1" : null,
        loser_next_slot: tournament.third_place_enabled && level.stage === "semifinal" ? index + 1 : null,
      });
      matchNumber += 1;
    }
  }

  if (tournament.third_place_enabled && stageConfig.some((level) => level.stage === "semifinal")) {
    definitions.push({
      key: "TP1",
      stage: "third_place",
      position: 1,
      match_number: matchNumber,
      team1_id: null,
      team2_id: null,
      team1_source: "Thua bán kết 1",
      team2_source: "Thua bán kết 2",
      next_key: null,
      next_slot: null,
      loser_next_key: null,
      loser_next_slot: null,
    });
  }
  return definitions;
}

async function unwrap(result, fallback = "Không thể xử lý dữ liệu giải đấu.") {
  if (result.error) throw new Error(result.error.message || fallback);
  return result.data;
}

export const tournamentsService = {
  async resolveGroup(authUser, authRole) {
    const person = await peopleService.getPersonByAuthUser(authUser);
    const groupId = await groupsService.resolveManagedGroupId(person, authRole);
    if (!groupId) throw httpError("Tài khoản chưa có nhóm đang hoạt động.", 403);
    return { person, groupId };
  },

  async list(authUser, authRole) {
    const { groupId } = await this.resolveGroup(authUser, authRole);
    return unwrap(await tournamentsRepository.list(groupId, authRole === "admin" || authRole === "owner"));
  },

  async get(id, authUser, authRole) {
    const { groupId } = await this.resolveGroup(authUser, authRole);
    const base = await unwrap(await tournamentsRepository.getBase(id));
    if (!base || base.group_id !== groupId) throw httpError("Không tìm thấy giải đấu.", 404);
    if (base.status === "draft" && authRole !== "admin" && authRole !== "owner") {
      throw httpError("Giải đấu chưa được công bố.", 403);
    }
    const [teams, members, groups, placements, matches] = await Promise.all([
      unwrap(await tournamentsRepository.getTeams(id)),
      unwrap(await tournamentsRepository.getTeamMembers(id)),
      unwrap(await tournamentsRepository.getGroups(id)),
      unwrap(await tournamentsRepository.getGroupTeams(id)),
      unwrap(await tournamentsRepository.getMatches(id)),
    ]);
    return normalizeTournament(base, teams || [], members || [], groups || [], placements || [], matches || []);
  },

  async create(payload, authUser, authRole) {
    const { groupId } = await this.resolveGroup(authUser, authRole);
    const name = cleanText(payload.name, 120);
    if (!name || name.length < 2) throw httpError("Tên giải phải có ít nhất 2 ký tự.");
    const groupCount = Number(payload.group_count || 2);
    const bestOf = Number(payload.best_of || 3);
    const knockoutStart = payload.knockout_start || (groupCount <= 1 ? "final" : groupCount <= 2 ? "semifinal" : "quarterfinal");
    if (groupCount < 1 || groupCount > 4) throw httpError("Số bảng phải từ 1 đến 4.");
    if (!BEST_OF_VALUES.has(bestOf)) throw httpError("Số hiệp không hợp lệ.");
    if (!KNOCKOUT_STARTS.has(knockoutStart)) throw httpError("Vòng bắt đầu không hợp lệ.");
    return unwrap(await tournamentsRepository.create({
      group_id: groupId,
      name,
      description: cleanText(payload.description, 1000),
      group_count: groupCount,
      knockout_start: knockoutStart,
      best_of: bestOf,
      third_place_enabled: Boolean(payload.third_place_enabled),
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      created_by_email: authUser?.email || null,
    }));
  },

  async update(id, payload, authUser, authRole) {
    const tournament = await this.get(id, authUser, authRole);
    const allowed = {};
    if (payload.name !== undefined) allowed.name = cleanText(payload.name, 120);
    if (payload.description !== undefined) allowed.description = cleanText(payload.description, 1000);
    if (payload.start_date !== undefined) allowed.start_date = payload.start_date || null;
    if (payload.end_date !== undefined) allowed.end_date = payload.end_date || null;
    if (payload.status !== undefined) {
      if (!STATUSES.has(payload.status)) throw httpError("Trạng thái giải không hợp lệ.");
      allowed.status = payload.status;
    }
    if (payload.best_of !== undefined) {
      const bestOf = Number(payload.best_of);
      if (!BEST_OF_VALUES.has(bestOf)) throw httpError("Số hiệp không hợp lệ.");
      allowed.best_of = bestOf;
    }
    if (payload.third_place_enabled !== undefined) allowed.third_place_enabled = Boolean(payload.third_place_enabled);
    if (!Object.keys(allowed).length) return tournament;
    return unwrap(await tournamentsRepository.update(id, allowed));
  },

  async configure(id, payload, authUser, authRole) {
    await this.get(id, authUser, authRole);
    const groupCount = Number(payload.group_count);
    const bestOf = Number(payload.best_of || 3);
    if (!Number.isInteger(groupCount) || groupCount < 1 || groupCount > 4) {
      throw httpError("Số bảng phải từ 1 đến 4.");
    }
    if (!BEST_OF_VALUES.has(bestOf)) throw httpError("Số hiệp không hợp lệ.");
    if (!KNOCKOUT_STARTS.has(payload.knockout_start)) throw httpError("Vòng bắt đầu không hợp lệ.");
    if (!Array.isArray(payload.teams) || payload.teams.length < groupCount * 2) {
      throw httpError("Mỗi bảng cần ít nhất hai đội.");
    }
    const capacity = stageCapacity(payload.knockout_start);
    if (groupCount * 2 > capacity) {
      throw httpError("Vòng bắt đầu đã chọn không đủ chỗ cho hai đội đầu mỗi bảng.");
    }
    return unwrap(await tournamentsRepository.configure(id, {
      teams: payload.teams,
      group_count: groupCount,
      knockout_start: payload.knockout_start,
      best_of: bestOf,
      third_place_enabled: Boolean(payload.third_place_enabled),
    }, authUser?.email));
  },

  async publish(id, authUser, authRole) {
    const tournament = await this.get(id, authUser, authRole);
    if (tournament.teams.length < tournament.group_count * 2 || !tournament.matches.length) {
      throw httpError("Hãy xếp đội vào bảng và dựng lịch trước khi công bố.");
    }
    return unwrap(await tournamentsRepository.update(id, { status: "group_stage" }));
  },

  async buildKnockout(id, authUser, authRole) {
    const tournament = await this.get(id, authUser, authRole);
    const groupMatches = tournament.matches.filter((match) => match.stage === "group");
    if (!groupMatches.length || groupMatches.some((match) => match.status !== "completed")) {
      throw httpError("Cần hoàn tất toàn bộ trận vòng bảng trước khi tạo vòng trong.");
    }
    const definitions = buildKnockoutMatches(tournament);
    await unwrap(await tournamentsRepository.replaceKnockout(id, definitions, authUser?.email));
    return this.get(id, authUser, authRole);
  },

  async saveMatch(tournamentId, matchId, payload, authUser, authRole) {
    const match = await unwrap(await tournamentsRepository.getMatch(matchId));
    if (!match) throw httpError("Không tìm thấy trận đấu.", 404);
    if (match.tournament_id !== tournamentId) throw httpError("Trận đấu không thuộc giải đã chọn.", 404);
    const tournament = await this.get(match.tournament_id, authUser, authRole);
    const hasKnockout = tournament.matches.some((item) => item.stage !== "group");
    if (match.stage === "group" && hasKnockout && !payload.rebuild_knockout) {
      throw httpError("Kết quả vòng bảng đã ảnh hưởng vòng trong. Hãy xác nhận dựng lại vòng trong.", 409);
    }
    if (match.stage === "group" && hasKnockout && payload.status && payload.status !== "completed") {
      throw httpError("Không thể mở lại hoặc hủy trận vòng bảng khi vòng trong đã được tạo. Hãy đặt lại đội và chia bảng nếu muốn làm lại toàn bộ giải.", 409);
    }
    if (match.stage === "group") {
      const group = tournament.groups.find((item) => item.id === match.group_id);
      const groupTeamIds = new Set((group?.standings || []).map((row) => row.team_id));
      const nextTeam1 = payload.team1_id ?? match.team1_id;
      const nextTeam2 = payload.team2_id ?? match.team2_id;
      if ((nextTeam1 && !groupTeamIds.has(nextTeam1)) || (nextTeam2 && !groupTeamIds.has(nextTeam2))) {
        throw httpError("Trận vòng bảng chỉ được chọn đội đang thuộc bảng này.");
      }
    }
    await unwrap(await tournamentsRepository.saveMatch(matchId, {
      status: payload.status || "completed",
      set_scores: payload.set_scores || [],
      team1_id: payload.team1_id ?? match.team1_id,
      team2_id: payload.team2_id ?? match.team2_id,
      scheduled_at: payload.scheduled_at ?? match.scheduled_at,
      court: payload.court ?? match.court,
      note: payload.note ?? match.note,
    }, authUser?.email));

    if (match.stage === "group" && hasKnockout) {
      return this.buildKnockout(match.tournament_id, authUser, authRole);
    }
    return this.get(match.tournament_id, authUser, authRole);
  },

  async remove(id, authUser, authRole) {
    await this.get(id, authUser, authRole);
    return unwrap(await tournamentsRepository.remove(id));
  },
};
