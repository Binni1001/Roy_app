import type { AdminTournament, AdminTournamentSummary, KnockoutStart, TeamSetup, TournamentInput, TournamentSetScore, TournamentSettings } from "@roy/shared";
import type { AuthUser } from "../auth.ts";
import { buildKnockoutMatches, KnockoutError, stageCapacity, type KnockoutDefinition } from "../domain/knockout.ts";
import { ActionError } from "./actions.ts";
import { managedGroup } from "./approvals.ts";
import { isDate } from "./availability.ts";
import type { BootstrapStore } from "./bootstrap.ts";
import { assembleTournament, NotFoundError, type ExtrasStore } from "./extras.ts";
import { ValidationError } from "./profile.ts";

export interface AdminTournamentStore extends BootstrapStore, Pick<ExtrasStore, "getTournament"> {
  listAdminTournaments(groupId: string): Promise<AdminTournamentSummary[]>;
  getTournamentSettings(id: string): Promise<(TournamentSettings & { description: string | null }) | null>;
  listGroupPlayers(groupId: string): Promise<{ id: string; name: string }[]>;
  createTournament(groupId: string, input: TournamentInput, actorEmail: string): Promise<string>;
  setTournamentStatus(id: string, status: "group_stage" | "cancelled"): Promise<void>;
  deleteTournament(id: string): Promise<void>;
  /** RPC configure_doubles_tournament: xóa đội, bảng, trận cũ rồi dựng lại vòng bảng. */
  configureTournament(id: string, teams: TeamSetup[], settings: TournamentSettings, actorEmail: string): Promise<void>;
  /** RPC replace_tournament_knockout. */
  replaceKnockout(id: string, definitions: KnockoutDefinition[], actorEmail: string): Promise<void>;
  getTournamentMatch(id: string): Promise<{ tournamentId: string; stage: string; status: string } | null>;
  /** RPC save_tournament_match: ghi tỷ số, tự tính bên thắng và đẩy đội lên vòng sau. */
  saveTournamentMatch(id: string, status: "completed" | "pending", setScores: TournamentSetScore[], actorEmail: string): Promise<void>;
}

const body = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const STARTS: KnockoutStart[] = ["quarterfinal", "semifinal", "final"];

function parseSettings(input: Record<string, unknown>): TournamentSettings {
  const groupCount = Number(input.groupCount ?? 2);
  const bestOf = Number(input.bestOf ?? 3);
  const knockoutStart = (input.knockoutStart ?? (groupCount <= 1 ? "final" : groupCount <= 2 ? "semifinal" : "quarterfinal")) as KnockoutStart;
  if (!Number.isInteger(groupCount) || groupCount < 1 || groupCount > 4) throw new ValidationError("Số bảng phải từ 1 đến 4.");
  if (![1, 3, 5].includes(bestOf)) throw new ValidationError("Số ván phải là 1, 3 hoặc 5.");
  if (!STARTS.includes(knockoutStart)) throw new ValidationError("Vòng bắt đầu loại trực tiếp không hợp lệ.");
  if (groupCount * 2 > stageCapacity(knockoutStart)) throw new ValidationError("Vòng bắt đầu đã chọn không đủ chỗ cho hai đội đầu mỗi bảng.");
  return { groupCount, bestOf, knockoutStart, thirdPlace: Boolean(input.thirdPlace) };
}

export function parseTournamentInput(raw: unknown): TournamentInput {
  const input = body(raw);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 120) throw new ValidationError("Tên giải từ 2 đến 120 ký tự.");
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > 1000) throw new ValidationError("Mô tả tối đa 1000 ký tự.");
  const date = (value: unknown, label: string) => {
    if (value === null || value === undefined || value === "") return null;
    if (!isDate(value)) throw new ValidationError(`${label} không hợp lệ.`);
    return value;
  };
  const startDate = date(input.startDate, "Ngày bắt đầu");
  const endDate = date(input.endDate, "Ngày kết thúc");
  if (startDate && endDate && endDate < startDate) throw new ValidationError("Ngày kết thúc không được trước ngày bắt đầu.");
  return { name, description: description || null, startDate, endDate, ...parseSettings(input) };
}

export function parseTeams(raw: unknown, settings: TournamentSettings, allowed: Set<string>): TeamSetup[] {
  if (!Array.isArray(raw)) throw new ValidationError("Danh sách đội không hợp lệ.");
  if (raw.length < settings.groupCount * 2) throw new ValidationError("Mỗi bảng cần ít nhất hai đội.");
  if (raw.length > 32) throw new ValidationError("Tối đa 32 đội.");
  const seen = new Set<string>();
  const teams = raw.map((item, index): TeamSetup => {
    const team = body(item);
    const memberIds = Array.isArray(team.memberIds) ? team.memberIds : [];
    if (memberIds.length !== 2 || memberIds.some((id) => typeof id !== "string" || !allowed.has(id))) {
      throw new ValidationError(`Đội ${index + 1} cần đúng hai người đang hoạt động trong nhóm.`);
    }
    for (const id of memberIds as string[]) {
      if (seen.has(id)) throw new ValidationError("Mỗi người chỉ được ở một đội.");
      seen.add(id);
    }
    const groupIndex = Number(team.groupIndex);
    if (!Number.isInteger(groupIndex) || groupIndex < 1 || groupIndex > settings.groupCount) {
      throw new ValidationError(`Đội ${index + 1} chưa được xếp vào bảng hợp lệ.`);
    }
    const name = typeof team.name === "string" && team.name.trim() ? team.name.trim().slice(0, 60) : `Đội ${index + 1}`;
    const seed = team.seed === null || team.seed === undefined || team.seed === "" ? null : Number(team.seed);
    if (seed !== null && (!Number.isInteger(seed) || seed < 1 || seed > 99)) throw new ValidationError("Hạt giống là số từ 1 đến 99.");
    return { name, seed, groupIndex, memberIds: memberIds as string[] };
  });
  for (let g = 1; g <= settings.groupCount; g++) {
    if (teams.filter((t) => t.groupIndex === g).length < 2) throw new ValidationError(`Bảng ${String.fromCharCode(64 + g)} cần ít nhất hai đội.`);
  }
  return teams;
}

async function ownTournament(user: AuthUser, id: string, store: AdminTournamentStore) {
  const groupId = await managedGroup(user, store);
  const data = await store.getTournament(id);
  const settings = await store.getTournamentSettings(id);
  if (!data || !settings || data.groupId !== groupId) throw new NotFoundError();
  return { groupId, data, settings };
}

export async function listAdminTournaments(user: AuthUser, store: AdminTournamentStore) {
  return store.listAdminTournaments(await managedGroup(user, store));
}

export async function loadAdminTournament(user: AuthUser, id: string, store: AdminTournamentStore): Promise<AdminTournament> {
  const { groupId, data, settings } = await ownTournament(user, id, store);
  return {
    ...assembleTournament(data),
    ...settings,
    teamCount: data.teams.length,
    hasKnockout: data.matches.some((m) => m.stage !== "group"),
    players: await store.listGroupPlayers(groupId),
  };
}

export async function createTournament(user: AuthUser, raw: unknown, store: AdminTournamentStore) {
  const groupId = await managedGroup(user, store);
  const id = await store.createTournament(groupId, parseTournamentInput(raw), user.email);
  return loadAdminTournament(user, id, store);
}

export async function configureTournament(user: AuthUser, id: string, raw: unknown, store: AdminTournamentStore) {
  const { groupId, data } = await ownTournament(user, id, store);
  if (data.summary.status !== "draft") {
    throw new ActionError("Giải đã công bố. Chỉ dựng lại đội và bảng khi giải còn là bản nháp.", 409, "TOURNAMENT_PUBLISHED");
  }
  const input = body(raw);
  const settings = parseSettings(input);
  const allowed = new Set((await store.listGroupPlayers(groupId)).map((p) => p.id));
  await store.configureTournament(id, parseTeams(input.teams, settings, allowed), settings, user.email);
  return loadAdminTournament(user, id, store);
}

export async function publishTournament(user: AuthUser, id: string, store: AdminTournamentStore) {
  const { data, settings } = await ownTournament(user, id, store);
  if (data.summary.status !== "draft") throw new ActionError("Giải đã được công bố.", 409, "TOURNAMENT_PUBLISHED");
  if (data.teams.length < settings.groupCount * 2 || !data.matches.length) {
    throw new ActionError("Xếp đội vào bảng và dựng lịch trước khi công bố.", 409, "TOURNAMENT_NOT_READY");
  }
  await store.setTournamentStatus(id, "group_stage");
  return loadAdminTournament(user, id, store);
}

async function rebuildKnockout(user: AuthUser, id: string, store: AdminTournamentStore) {
  const { data, settings } = await ownTournament(user, id, store);
  const groupMatches = data.matches.filter((m) => m.stage === "group");
  if (!groupMatches.length || groupMatches.some((m) => m.status !== "completed")) {
    throw new ActionError("Cần hoàn tất toàn bộ trận vòng bảng trước khi tạo vòng trong.", 409, "GROUPS_NOT_DONE");
  }
  const detail = assembleTournament(data);
  try {
    const definitions = buildKnockoutMatches({
      knockoutStart: settings.knockoutStart,
      thirdPlace: settings.thirdPlace,
      groups: detail.groups.map((g) => g.standings.map((row) => row.team.id)),
      lastMatchNumber: Math.max(0, ...groupMatches.map((m) => m.matchNumber ?? 0)),
    });
    await store.replaceKnockout(id, definitions, user.email);
  } catch (error) {
    if (error instanceof KnockoutError) throw new ActionError(error.message, 409, "KNOCKOUT_INVALID");
    throw error;
  }
}

export async function buildKnockout(user: AuthUser, id: string, store: AdminTournamentStore) {
  await rebuildKnockout(user, id, store);
  return loadAdminTournament(user, id, store);
}

export async function saveTournamentMatch(user: AuthUser, matchId: string, raw: unknown, store: AdminTournamentStore) {
  const match = await store.getTournamentMatch(matchId);
  if (!match) throw new NotFoundError();
  const { data, settings } = await ownTournament(user, match.tournamentId, store);
  if (data.summary.status === "draft") throw new ActionError("Công bố giải trước khi nhập tỷ số.", 409, "TOURNAMENT_DRAFT");
  const input = body(raw);
  const reopen = input.status === "pending";
  const hasKnockout = data.matches.some((m) => m.stage !== "group");
  if (match.stage === "group" && hasKnockout) {
    if (reopen) throw new ActionError("Vòng trong đã tạo: không mở lại trận vòng bảng được.", 409, "KNOCKOUT_EXISTS");
    if (input.rebuildKnockout !== true) {
      throw new ActionError("Kết quả vòng bảng ảnh hưởng vòng trong. Xác nhận dựng lại vòng trong để lưu.", 409, "CONFIRM_REBUILD");
    }
  }
  const scores = Array.isArray(input.setScores) ? input.setScores : [];
  const setScores: TournamentSetScore[] = reopen
    ? []
    : scores.map((item) => {
        const s = body(item);
        const team1 = Number(s.team1);
        const team2 = Number(s.team2);
        if (!Number.isSafeInteger(team1) || !Number.isSafeInteger(team2) || team1 < 0 || team2 < 0 || team1 > 99 || team2 > 99 || team1 === team2) {
          throw new ValidationError("Mỗi ván phải có một đội thắng, điểm là số nguyên không âm.");
        }
        return { team1, team2 };
      });
  if (!reopen && (setScores.length === 0 || setScores.length > settings.bestOf)) {
    throw new ValidationError(`Nhập tỷ số từ 1 đến ${settings.bestOf} ván.`);
  }
  await store.saveTournamentMatch(matchId, reopen ? "pending" : "completed", setScores, user.email);
  if (match.stage === "group" && hasKnockout) await rebuildKnockout(user, match.tournamentId, store);
  return loadAdminTournament(user, match.tournamentId, store);
}

export async function cancelTournament(user: AuthUser, id: string, store: AdminTournamentStore) {
  await ownTournament(user, id, store);
  await store.setTournamentStatus(id, "cancelled");
  return loadAdminTournament(user, id, store);
}

export async function deleteTournament(user: AuthUser, id: string, store: AdminTournamentStore) {
  const { data } = await ownTournament(user, id, store);
  if (data.summary.status !== "draft" && data.summary.status !== "cancelled") {
    throw new ActionError("Chỉ xóa được giải nháp hoặc đã hủy. Hủy giải trước.", 409, "TOURNAMENT_ACTIVE");
  }
  await store.deleteTournament(id);
  return listAdminTournaments(user, store);
}
