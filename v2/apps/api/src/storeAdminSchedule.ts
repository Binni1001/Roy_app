import type { AdminOpenDay, AdminSession, GuestRow, SchedulePerson } from "@roy/shared";
import { db } from "./db.ts";
import { ActionError } from "./routes/actions.ts";
import type { AdminScheduleStore } from "./routes/adminSchedule.ts";
import { ValidationError } from "./routes/profile.ts";

type Own = Omit<AdminScheduleStore, "findPerson" | "findOpenPeriod">;

function ensure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const personName = (person: { full_name: string; nickname: string | null } | null) =>
  person?.nickname || person?.full_name || "Thành viên";

/** Lỗi của các hàm database, đổi sang lời nhắn cho owner. */
function guestError(error: { code?: string; message: string }): Error {
  const m = error.message;
  if (/V2_GUEST_FEE_PAID/.test(m)) {
    return new ActionError("Khách đã trả phí buổi này nên không đổi hay xóa được. Hoàn tiền ở sổ quỹ trước nếu cần.", 409, "GUEST_FEE_PAID");
  }
  if (/V2_ALREADY_IN_SESSION/.test(m)) return new ActionError("Người này đã có trong buổi.", 409, "ALREADY_IN_SESSION");
  if (/V2_PERSON_NOT_IN_GROUP/.test(m)) return new ValidationError("Người này không còn hoạt động trong nhóm.");
  if (/V2_PERIOD_SETTLED|Ky da chot/i.test(m)) {
    return new ActionError("Kỳ đã chốt chia tiền cầu, không ghi thêm phí được.", 409, "PERIOD_SETTLED");
  }
  if (/V2_PERIOD_NOT_OPEN/.test(m)) return new ActionError("Kỳ không còn mở.", 409, "PERIOD_NOT_OPEN");
  if (/V2_INVALID_AMOUNT|V2_NOTE_TOO_LONG/.test(m)) return new ValidationError("Số tiền hoặc ghi chú không hợp lệ.");
  if (["PGRST202", "42883"].includes(error.code ?? "")) {
    return new ActionError("Database chưa có hàm của v2. Chạy file supabase/20261116_v2_guest_attendance.sql trước.", 503, "MIGRATION_NEEDED");
  }
  console.error("[guest attendance]", m);
  return new ActionError("Không lưu được khách. Thử lại sau.", 503, "GUEST_ERROR");
}

/** Truy vấn cho màn hình Lịch & điểm danh của owner. Không chứa logic nghiệp vụ. */
export const supabaseAdminSchedule: Own = {
  async loadAdminSchedule(period, groupId) {
    const [periodRow, settled, days, sessions, people, fixed] = await Promise.all([
      db().from("periods").select("guest_fee_per_session").eq("id", period.id).single(),
      db().from("shuttle_settlement_runs").select("period_id").eq("period_id", period.id).maybeSingle(),
      db()
        .from("open_play_days")
        .select("play_date, status, capacity, open_play_registrations(person_id, created_at, person:people(full_name, nickname))")
        .eq("period_id", period.id)
        .order("play_date"),
      db()
        .from("badminton_sessions")
        .select("id, play_date, shuttle_used_count, note, guest_attendances(id, person_id, amount, note, created_at, person:people(full_name, nickname))")
        .eq("period_id", period.id)
        .order("play_date", { ascending: false }),
      db()
        .from("person_groups")
        .select("person:people!inner(id, full_name, nickname, status)")
        .eq("group_id", groupId)
        .eq("status", "active")
        .eq("person.status", "active"),
      db().from("period_members").select("person_id").eq("period_id", period.id).eq("status", "fixed"),
    ]);
    for (const result of [periodRow, settled, days, sessions, people, fixed]) ensure(result.error);

    type Reg = { person_id: string; created_at: string; person: { full_name: string; nickname: string | null } | null };
    const openDays = ((days.data ?? []) as unknown as { play_date: string; status: string; capacity: number; open_play_registrations: Reg[] }[]).map(
      (day): AdminOpenDay => {
        const regs = [...day.open_play_registrations].sort((a, b) => a.created_at.localeCompare(b.created_at));
        return {
          date: day.play_date,
          status: day.status === "closed" ? "closed" : "open",
          capacity: day.capacity,
          names: regs.map((r) => personName(r.person)),
          personIds: regs.map((r) => r.person_id),
        };
      },
    );

    type Attendance = {
      id: string;
      person_id: string;
      amount: number | string;
      note: string | null;
      created_at: string;
      person: { full_name: string; nickname: string | null } | null;
    };
    const sessionRows = (sessions.data ?? []) as unknown as {
      id: string;
      play_date: string;
      shuttle_used_count: number;
      note: string | null;
      guest_attendances: Attendance[];
    }[];

    // Trạng thái phí của từng khách: lấy khoản nợ phí khách chưa hủy gắn với dòng điểm danh.
    const attendanceIds = sessionRows.flatMap((s) => s.guest_attendances.map((g) => g.id));
    const feeStatus = new Map<string, "unpaid" | "paid">();
    if (attendanceIds.length) {
      const fees = await db()
        .from("debts")
        .select("source_attendance_id, status")
        .in("source_attendance_id", attendanceIds)
        .eq("debt_type", "guest_fee")
        .neq("status", "cancelled");
      ensure(fees.error);
      for (const row of fees.data ?? []) {
        const key = row.source_attendance_id as string;
        if (row.status === "paid" || !feeStatus.has(key)) feeStatus.set(key, row.status === "paid" ? "paid" : "unpaid");
      }
    }

    const fixedIds = new Set((fixed.data ?? []).map((row) => row.person_id as string));
    return {
      guestFee: Number(periodRow.data?.guest_fee_per_session ?? 0),
      settled: Boolean(settled.data),
      openDays,
      sessions: sessionRows.map(
        (s): AdminSession => ({
          id: s.id,
          date: s.play_date,
          shuttles: s.shuttle_used_count ?? 0,
          note: s.note,
          guests: [...s.guest_attendances]
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map(
              (g): GuestRow => ({
                id: g.id,
                personId: g.person_id,
                name: personName(g.person),
                amount: Number(g.amount ?? 0),
                note: g.note,
                feeStatus: feeStatus.get(g.id) ?? "none",
              }),
            ),
        }),
      ),
      people: ((people.data ?? []) as unknown as { person: { id: string; full_name: string; nickname: string | null } }[])
        .map(({ person }): SchedulePerson => ({ id: person.id, name: person.nickname || person.full_name, fixed: fixedIds.has(person.id) }))
        .sort((a, b) => a.name.localeCompare(b.name, "vi")),
    };
  },

  async mutateDay(periodId, date, actorId, action) {
    const { error } = await db().rpc("mutate_open_play_day", {
      p_period_id: periodId,
      p_play_date: date,
      p_actor_id: actorId,
      p_action: action,
      p_note: "",
    });
    if (!error) return;
    if (error.code === "42501") throw new ActionError("Tài khoản không có quyền quản trị lịch của nhóm này.", 403, "OPEN_DAY_FORBIDDEN");
    if (error.code === "22023") {
      throw new ActionError("Ngày này không thao tác được: đã qua 17:30 ngày đó, hoặc chưa được mở.", 409, "OPEN_DAY_UNAVAILABLE");
    }
    console.error("[mutate_open_play_day admin]", error.message);
    throw new ActionError("Không lưu được ngày tự đăng ký. Thử lại sau.", 503, "OPEN_DAY_ERROR");
  },

  async getSessionPeriodId(sessionId) {
    const { data, error } = await db().from("badminton_sessions").select("period_id").eq("id", sessionId).maybeSingle();
    ensure(error);
    return (data?.period_id as string | undefined) ?? null;
  },

  async createSession(periodId, input) {
    const { error } = await db()
      .from("badminton_sessions")
      .insert({ period_id: periodId, play_date: input.date, shuttle_used_count: input.shuttles, note: input.note });
    ensure(error);
  },

  async updateSession(sessionId, input) {
    const { error } = await db()
      .from("badminton_sessions")
      .update({ play_date: input.date, shuttle_used_count: input.shuttles, note: input.note, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    ensure(error);
  },

  async deleteSession(sessionId) {
    const guests = await db().from("guest_attendances").select("id", { count: "exact", head: true }).eq("session_id", sessionId);
    ensure(guests.error);
    if ((guests.count ?? 0) > 0) return false;
    const { error } = await db().from("badminton_sessions").delete().eq("id", sessionId);
    if (error?.code === "23503") {
      throw new ActionError("Buổi này đã gắn với dữ liệu khác nên không xóa được.", 409, "SESSION_IN_USE");
    }
    ensure(error);
    return true;
  },

  async getGuestSessionId(attendanceId) {
    const { data, error } = await db().from("guest_attendances").select("session_id").eq("id", attendanceId).maybeSingle();
    ensure(error);
    return (data?.session_id as string | undefined) ?? null;
  },

  async getGuestFee(periodId) {
    const { data, error } = await db().from("periods").select("guest_fee_per_session").eq("id", periodId).single();
    ensure(error);
    return Number(data?.guest_fee_per_session ?? 0);
  },

  async addGuest(sessionId, personId, amount, note) {
    const { data, error } = await db().rpc("v2_add_guest_attendance", {
      p_session_id: sessionId,
      p_person_id: personId,
      p_amount: amount,
      p_note: note,
    });
    if (error) throw guestError(error);
    return Boolean((data as { fee_created?: boolean } | null)?.fee_created);
  },

  async updateGuest(attendanceId, amount, note) {
    const { data, error } = await db().rpc("v2_update_guest_attendance", { p_attendance_id: attendanceId, p_amount: amount, p_note: note });
    if (error) throw guestError(error);
    return Boolean((data as { fee_changed?: boolean } | null)?.fee_changed);
  },

  async removeGuest(attendanceId) {
    const { data, error } = await db().rpc("v2_remove_guest_attendance", { p_attendance_id: attendanceId });
    if (error) throw guestError(error);
    return Boolean((data as { fee_cancelled?: boolean } | null)?.fee_cancelled);
  },
};
