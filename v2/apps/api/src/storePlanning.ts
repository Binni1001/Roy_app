import type { PendingMember } from "@roy/shared";
import { db } from "./db.ts";
import { ActionError } from "./routes/actions.ts";
import type { ApprovalStore } from "./routes/approvals.ts";
import type { AvailabilityStore } from "./routes/availability.ts";

type Own<T> = Omit<T, "findPerson" | "findOpenPeriod">;

function ensure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Lỗi của RPC save_session_planning_preferences, đổi sang lời nhắn cho người dùng. */
function planningError(error: { code?: string; message: string }): ActionError {
  switch (error.code) {
    case "40001":
      return new ActionError("Lịch bận vừa được sửa ở nơi khác. Tải lại rồi thử lại.", 409, "PLANNING_REVISION_CONFLICT");
    case "42501":
      return new ActionError("Bạn không còn đủ điều kiện khai lịch bận trong kỳ này.", 403, "PLANNING_FORBIDDEN");
    case "22023":
    case "23514":
      return new ActionError("Lịch bận không hợp lệ, hoặc kỳ đã đóng.", 409, "PLANNING_INVALID");
    case "42P01":
    case "42883":
    case "PGRST202":
    case "PGRST205":
      return new ActionError("Chức năng lịch bận chưa được cài trên database.", 503, "PLANNING_SCHEMA_NOT_READY");
    default:
      console.error("[save_session_planning_preferences]", error.message);
      return new ActionError("Không lưu được lịch bận. Thử lại sau.", 503, "PLANNING_UNAVAILABLE");
  }
}

/** Truy vấn cho lịch bận và duyệt thành viên. Không chứa logic nghiệp vụ. */
export const supabasePlanning: Own<AvailabilityStore> & Own<ApprovalStore> = {
  async isFixedMember(periodId, personId) {
    const { data, error } = await db()
      .from("period_members")
      .select("id")
      .eq("period_id", periodId)
      .eq("person_id", personId)
      .eq("status", "fixed")
      .limit(1);
    ensure(error);
    return (data ?? []).length > 0;
  },

  async getPreferences(periodId, personId) {
    const { data, error } = await db()
      .from("session_planning_preferences")
      .select("busy_weekdays, date_overrides, revision")
      .eq("period_id", periodId)
      .eq("person_id", personId)
      .maybeSingle();
    if (error) throw planningError(error);
    if (!data) return null;
    return {
      busyWeekdays: (data.busy_weekdays as number[] | null) ?? [],
      dateOverrides: (data.date_overrides as Record<string, string> | null) ?? {},
      revision: Number(data.revision ?? 0),
    };
  },

  async listOpenDayDates(periodId) {
    const { data, error } = await db().from("open_play_days").select("play_date").eq("period_id", periodId).limit(500);
    ensure(error);
    return (data ?? []).map((row) => row.play_date as string);
  },

  async savePreferences(periodId, personId, actorId, input) {
    const { error } = await db().rpc("save_session_planning_preferences", {
      p_period_id: periodId,
      p_person_id: personId,
      p_actor_id: actorId,
      p_expected_revision: input.expectedRevision,
      p_busy_weekdays: input.busyWeekdays,
      p_date_overrides: input.dateOverrides,
    });
    if (error) throw planningError(error);
  },

  async listPendingMembers(groupId) {
    const { data, error } = await db()
      .from("person_groups")
      .select("joined_at, person:people!inner(id, full_name, nickname, email, avatar_url)")
      .eq("group_id", groupId)
      .eq("status", "pending")
      .order("joined_at", { ascending: true });
    ensure(error);
    const rows = (data ?? []) as unknown as {
      joined_at: string;
      person: { id: string; full_name: string; nickname: string | null; email: string | null; avatar_url: string | null };
    }[];
    return rows.map(
      ({ joined_at, person }): PendingMember => ({
        personId: person.id,
        fullName: person.full_name,
        nickname: person.nickname,
        email: person.email,
        avatarUrl: person.avatar_url,
        requestedAt: joined_at,
      }),
    );
  },

  async getMembershipStatus(personId, groupId) {
    const { data, error } = await db()
      .from("person_groups")
      .select("status")
      .eq("person_id", personId)
      .eq("group_id", groupId)
      .maybeSingle();
    ensure(error);
    return (data?.status as string | undefined) ?? null;
  },

  async decideMembership(personId, groupId, decision) {
    const people = () => db().from("people");
    const before = await people().select("status, active_group_id").eq("id", personId).single();
    ensure(before.error);
    const { status: previousStatus, active_group_id: previousGroup } = before.data as {
      status: string;
      active_group_id: string | null;
    };

    // Chỉ đổi khi yêu cầu còn đang chờ: hai owner bấm cùng lúc thì một người nhận false.
    const changed = await db()
      .from("person_groups")
      .update({ status: decision === "approve" ? "active" : "inactive" })
      .eq("person_id", personId)
      .eq("group_id", groupId)
      .eq("status", "pending")
      .select("id");
    ensure(changed.error);
    if (!(changed.data ?? []).length) return false;

    try {
      const others = await db()
        .from("person_groups")
        .select("group_id")
        .eq("person_id", personId)
        .eq("status", "active")
        .neq("group_id", groupId);
      ensure(others.error);
      const hasOtherGroup = (others.data ?? []).length > 0;
      const now = new Date().toISOString();
      if (decision === "approve") {
        const update: Record<string, unknown> = { status: "active", updated_at: now };
        if (!hasOtherGroup) update.active_group_id = groupId;
        ensure((await people().update(update).eq("id", personId)).error);
      } else if (!hasOtherGroup) {
        ensure((await people().update({ status: "inactive", active_group_id: null, updated_at: now }).eq("id", personId)).error);
      }
    } catch (error) {
      // Không có giao dịch qua PostgREST: trả mọi thứ về như trước, như bản cũ.
      await db().from("person_groups").update({ status: "pending" }).eq("person_id", personId).eq("group_id", groupId);
      await people().update({ status: previousStatus, active_group_id: previousGroup }).eq("id", personId);
      throw error;
    }
    return true;
  },
};
