import type { Schedule } from "@roy/shared";
import type { AuthUser } from "../auth.ts";
import { NotFoundError } from "./extras.ts";
import { loadSchedule, type Member, type MemberStore } from "./member.ts";

export type OpenDayAction = "join" | "leave";

/** Lỗi nghiệp vụ có mã để web hiện đúng lời nhắn. */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 409 | 503,
    readonly code: string,
  ) {
    super(message);
  }
}

export interface ActionsStore {
  markNotificationsRead(personId: string): Promise<void>;
  findOpenDay(dayId: string): Promise<{ periodId: string; date: string; groupId: string | null } | null>;
  /**
   * Gọi RPC mutate_open_play_day. Database tự kiểm tra sức chứa, hạn giờ,
   * trạng thái kỳ và quyền trong nhóm trong cùng một giao dịch.
   */
  mutateOpenDay(periodId: string, date: string, actorId: string, action: OpenDayAction): Promise<void>;
}

export async function changeOpenDay(
  user: AuthUser,
  member: Member,
  dayId: string,
  action: OpenDayAction,
  store: ActionsStore & MemberStore,
): Promise<Schedule> {
  const day = await store.findOpenDay(dayId);
  // Buổi của nhóm khác được báo là không tồn tại.
  if (!day || day.groupId !== member.groupId) throw new NotFoundError();
  await store.mutateOpenDay(day.periodId, day.date, user.id, action);
  return loadSchedule(member, store);
}
