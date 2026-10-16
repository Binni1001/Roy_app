import { pkMatchesRepository } from "./pkMatches.repository.js";

// Period state is authoritative; no production IDs or player data are bundled.
export async function assertPkPeriodWritable(periodId) {
  if (!periodId) return; // Payload validation reports a missing ID.
  const { data, error } = await pkMatchesRepository.getScoringRule(periodId);
  if (error) throw new Error("Không thể kiểm tra trạng thái kỳ. Vui lòng thử lại.");
  if (!data || data.status !== "open") {
    throw new Error("Kỳ không đang mở hoặc đã được lưu lịch sử, không thể thay đổi trận đấu.");
  }
}
