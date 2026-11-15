import type { AdminMatch, MatchSide, PeriodSummary, SetScore } from "@roy/shared";
import type { AuthUser } from "../auth.ts";
import { ActionError } from "./actions.ts";
import { managedGroup } from "./approvals.ts";
import type { BootstrapStore } from "./bootstrap.ts";
import { NotFoundError } from "./extras.ts";
import { parseResult, type MatchStore } from "./matches.ts";
import { ValidationError } from "./profile.ts";

export interface AdminMatchStore extends BootstrapStore, Pick<MatchStore, "getMatch" | "setMatchStatus" | "finalizeMatch"> {
  listAdminMatches(periodId: string): Promise<AdminMatch[]>;
  /** RPC correct_pk_match_result: sửa tỷ số trận đã xong, kiểm tra updated_at để không ghi đè. */
  correctMatch(id: string, winnerSide: MatchSide, setScores: SetScore[], expectedUpdatedAt: string, actorEmail: string): Promise<void>;
  /** RPC void_pk_match: hủy kết quả trận đã xong, có lý do, tính lại bảng. */
  voidMatch(id: string, reason: string, actorEmail: string): Promise<void>;
}

export interface AdminMatches {
  period: PeriodSummary | null;
  matches: AdminMatch[];
  notice: string | null;
}

async function context(user: AuthUser, store: AdminMatchStore) {
  const groupId = await managedGroup(user, store);
  return { groupId, period: await store.findOpenPeriod(groupId) };
}

export async function loadAdminMatches(user: AuthUser, store: AdminMatchStore, notice: string | null = null): Promise<AdminMatches> {
  const { period } = await context(user, store);
  return { period, matches: period ? await store.listAdminMatches(period.id) : [], notice };
}

/** Trận phải thuộc kỳ đang mở của nhóm owner; kỳ đã đóng giữ nguyên lịch sử. */
async function ownMatch(user: AuthUser, id: string, store: AdminMatchStore) {
  const { groupId, period } = await context(user, store);
  const match = await store.getMatch(id);
  if (!match || match.groupId !== groupId) throw new NotFoundError();
  if (!period || match.periodId !== period.id) {
    throw new ActionError("Chỉ sửa được kèo của kỳ đang mở. Kỳ đã đóng giữ nguyên lịch sử.", 409, "PERIOD_LOCKED");
  }
  return match;
}

const body = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

export async function adminMatchAction(user: AuthUser, id: string, action: string, raw: unknown, store: AdminMatchStore) {
  const match = await ownMatch(user, id, store);
  const input = body(raw);
  if (action === "cancel") {
    if (!(await store.setMatchStatus(id, "cancelled", ["pending", "active"]))) {
      throw new ActionError("Chỉ hủy được kèo chưa có kết quả. Trận đã xong thì dùng Hủy kết quả.", 409, "MATCH_CHANGED");
    }
    return loadAdminMatches(user, store, "Đã hủy kèo.");
  }
  if (action === "result") {
    if (match.status !== "pending" && match.status !== "active") throw new ActionError("Trận đã có kết quả. Dùng Sửa tỷ số.", 409, "MATCH_CHANGED");
    const { winnerSide, setScores } = parseResult(input, match.sets);
    await store.finalizeMatch(id, winnerSide, setScores, user.email);
    return loadAdminMatches(user, store, "Đã ghi kết quả.");
  }
  if (action === "correct") {
    if (match.status !== "completed") throw new ActionError("Chỉ sửa tỷ số trận đã hoàn tất.", 409, "MATCH_CHANGED");
    if (typeof input.expectedUpdatedAt !== "string" || Number.isNaN(Date.parse(input.expectedUpdatedAt))) {
      throw new ValidationError("Tải lại trận trước khi sửa tỷ số.");
    }
    const { winnerSide, setScores } = parseResult(input, match.sets);
    await store.correctMatch(id, winnerSide, setScores, input.expectedUpdatedAt, user.email);
    return loadAdminMatches(user, store, "Đã sửa tỷ số và tính lại bảng xếp hạng.");
  }
  if (action === "void") {
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (reason.length < 5 || reason.length > 300) throw new ValidationError("Ghi lý do hủy kết quả, từ 5 đến 300 ký tự.");
    if (match.status !== "completed") throw new ActionError("Chỉ hủy kết quả của trận đã hoàn tất.", 409, "MATCH_CHANGED");
    await store.voidMatch(id, reason, user.email);
    return loadAdminMatches(user, store, "Đã hủy kết quả trận. Bảng xếp hạng được tính lại.");
  }
  throw new NotFoundError();
}
