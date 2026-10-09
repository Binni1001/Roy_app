import june from "./archives/june2026.js";

// Bundle the frozen archive with the API. No recalculation or database writes.

export function isArchivedPkPeriod(periodId) {
  return periodId === june.period.id;
}

export function assertPkPeriodWritable(periodId) {
  if (isArchivedPkPeriod(periodId)) {
    throw new Error("Đấu trường kỳ tháng 6 đã được lưu lịch sử, không thể thay đổi trận đấu.");
  }
}

export function archivedPkLeaderboard(periodId, matchType) {
  if (!isArchivedPkPeriod(periodId)) return null;
  if (!Object.hasOwn(june.rankings, matchType)) throw new Error("Loại bảng xếp hạng không hợp lệ.");
  return {
    period_id: periodId, match_type: matchType, archived: true,
    scoring_method: "legacy_wilson", requirements: { min_matches: 0, min_opponents: 0 },
    recovery: {
      status: june.recovery_status, saved_at: june.exported_at,
      source_commit: june.source_commit, evidence_sha256: june.evidence_sha256,
      original_snapshot_verified: false,
    },
    ranked: structuredClone(june.rankings[matchType]), qualifying: [],
  };
}
