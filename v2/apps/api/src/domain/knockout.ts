/**
 * Dựng vòng loại trực tiếp từ thứ hạng vòng bảng.
 * Chuyển nguyên từ naturalQualifierSlots và buildKnockoutMatches trong
 * backend/src/modules/tournaments/tournaments.service.js; kết quả gửi cho RPC replace_tournament_knockout.
 */

export type KnockoutStart = "quarterfinal" | "semifinal" | "final";

/** Đội trong từng bảng theo thứ hạng (bảng theo đúng thứ tự A, B, C, D). */
export type GroupRanking = string[];

interface Slot {
  team_id: string;
  source: string;
}

export interface KnockoutDefinition {
  key: string;
  stage: string;
  position: number;
  match_number: number;
  team1_id: string | null;
  team2_id: string | null;
  team1_source: string | null;
  team2_source: string | null;
  next_key: string | null;
  next_slot: number | null;
  loser_next_key: string | null;
  loser_next_slot: number | null;
}

export class KnockoutError extends Error {}

function naturalQualifierSlots(groups: GroupRanking[]): (Slot | null)[] {
  const first = groups.map((g) => g[0]).filter(Boolean);
  const second = groups.map((g) => g[1]).filter(Boolean);
  const source = (teamId: string | undefined, label: string): Slot | null => (teamId ? { team_id: teamId, source: label } : null);

  if (groups.length === 1) return [source(first[0], "Nhất bảng A"), source(second[0], "Nhì bảng A")];
  if (groups.length === 2) {
    return [source(first[0], "Nhất bảng A"), source(second[1], "Nhì bảng B"), source(first[1], "Nhất bảng B"), source(second[0], "Nhì bảng A")];
  }
  if (groups.length === 3) {
    return [
      source(first[0], "Nhất bảng A"),
      null,
      source(first[2], "Nhất bảng C"),
      source(second[1], "Nhì bảng B"),
      source(first[1], "Nhất bảng B"),
      null,
      source(second[0], "Nhì bảng A"),
      source(second[2], "Nhì bảng C"),
    ];
  }
  return [
    source(first[0], "Nhất bảng A"),
    source(second[1], "Nhì bảng B"),
    source(first[2], "Nhất bảng C"),
    source(second[3], "Nhì bảng D"),
    source(first[1], "Nhất bảng B"),
    source(second[0], "Nhì bảng A"),
    source(first[3], "Nhất bảng D"),
    source(second[2], "Nhì bảng C"),
  ];
}

export function stageCapacity(stage: KnockoutStart): number {
  return stage === "quarterfinal" ? 8 : stage === "semifinal" ? 4 : 2;
}

function expandSlots(slots: (Slot | null)[], capacity: number): (Slot | null)[] {
  let expanded = [...slots];
  while (expanded.length < capacity) expanded = expanded.flatMap((slot) => [slot, null]);
  return expanded;
}

export function buildKnockoutMatches(input: {
  knockoutStart: KnockoutStart;
  thirdPlace: boolean;
  groups: GroupRanking[];
  /** Số thứ tự lớn nhất của các trận hiện có (vòng bảng). */
  lastMatchNumber: number;
}): KnockoutDefinition[] {
  const capacity = stageCapacity(input.knockoutStart);
  const natural = naturalQualifierSlots(input.groups);
  if (natural.filter(Boolean).length > capacity) {
    throw new KnockoutError("Vòng bắt đầu đã chọn không đủ chỗ cho các đội vượt qua vòng bảng.");
  }
  const slots = expandSlots(natural, capacity);
  let matchNumber = Math.max(0, input.lastMatchNumber) + 1;
  const definitions: KnockoutDefinition[] = [];
  const stageConfig =
    input.knockoutStart === "quarterfinal"
      ? [
          { stage: "quarterfinal", key: "QF", count: 4, next: "SF" },
          { stage: "semifinal", key: "SF", count: 2, next: "F" },
          { stage: "final", key: "F", count: 1, next: null },
        ]
      : input.knockoutStart === "semifinal"
        ? [
            { stage: "semifinal", key: "SF", count: 2, next: "F" },
            { stage: "final", key: "F", count: 1, next: null },
          ]
        : [{ stage: "final", key: "F", count: 1, next: null }];

  for (const level of stageConfig) {
    for (let index = 0; index < level.count; index += 1) {
      const isFirstLevel = level.stage === input.knockoutStart;
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
        loser_next_key: input.thirdPlace && level.stage === "semifinal" ? "TP1" : null,
        loser_next_slot: input.thirdPlace && level.stage === "semifinal" ? index + 1 : null,
      });
      matchNumber += 1;
    }
  }

  if (input.thirdPlace && stageConfig.some((level) => level.stage === "semifinal")) {
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
