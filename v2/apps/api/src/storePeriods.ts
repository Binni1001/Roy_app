import type { AdminPeriod, PeriodMemberRow, PeriodStatus, ShuttleDiscount } from "@roy/shared";
import { db } from "./db.ts";
import { ActionError } from "./routes/actions.ts";
import type { FeeAction, PeriodsStore } from "./routes/periods.ts";
import { ValidationError } from "./routes/profile.ts";

type Own = Omit<PeriodsStore, "findPerson" | "findOpenPeriod">;

function ensure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

interface PeriodRow {
  id: string;
  group_id: string | null;
  name: string;
  status: PeriodStatus;
  start_date: string;
  end_date: string;
  fixed_member_fee: number | string;
  guest_fee_per_session: number | string;
  note: string | null;
}

const PERIOD = "id, group_id, name, status, start_date, end_date, fixed_member_fee, guest_fee_per_session, note";

function toPeriod(row: PeriodRow, settled: boolean, memberCount: number): AdminPeriod & { groupId: string | null } {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    fixedMemberFee: Number(row.fixed_member_fee ?? 0),
    guestFeePerSession: Number(row.guest_fee_per_session ?? 0),
    note: row.note,
    settled,
    memberCount,
  };
}

/** Lỗi do trigger và hàm của database đặt ra, đổi sang lời nhắn cho owner. */
function periodError(error: { code?: string; message: string }): Error {
  const message = error.message;
  if (/Can chot cau va dong ky dang mo/i.test(message)) {
    return new ActionError("Đang có một kỳ mở. Chốt chia tiền cầu và đóng kỳ đó trước khi mở kỳ mới.", 409, "PERIOD_ALREADY_OPEN");
  }
  if (/Quy ky truoc phai bang 0/i.test(message)) {
    return new ActionError("Quỹ của kỳ trước phải về 0 trước khi mở kỳ mới.", 409, "PREVIOUS_FUND_NOT_ZERO");
  }
  if (/V2_PERIOD_CLOSED/.test(message)) return new ActionError("Kỳ đã đóng.", 409, "PERIOD_CLOSED");
  if (/V2_PERIOD_SETTLED|Ky da chot chia cau/i.test(message)) {
    return new ActionError("Kỳ đã chốt chia tiền cầu, không đổi thành viên hay mức miễn được.", 409, "PERIOD_SETTLED");
  }
  if (/V2_PERSON_NOT_IN_GROUP|V2_PERSON_NOT_FOUND/.test(message)) {
    return new ValidationError("Có người không còn hoạt động trong nhóm. Tải lại danh sách rồi chọn lại.");
  }
  if (["PGRST202", "42883"].includes(error.code ?? "")) {
    return new ActionError("Database chưa có hàm của v2. Chạy file supabase/20261116_v2_period_members.sql trước.", 503, "MIGRATION_NEEDED");
  }
  console.error("[periods]", message);
  return new ActionError("Không lưu được thay đổi của kỳ. Thử lại sau.", 503, "PERIOD_ERROR");
}

async function settledIds(periodIds: string[]): Promise<Set<string>> {
  if (!periodIds.length) return new Set();
  const { data, error } = await db().from("shuttle_settlement_runs").select("period_id").in("period_id", periodIds);
  ensure(error);
  return new Set((data ?? []).map((row) => row.period_id as string));
}

/** Truy vấn cho màn hình Kỳ quỹ. Không chứa logic nghiệp vụ. */
export const supabasePeriods: Own = {
  async listPeriods(groupId) {
    const { data, error } = await db()
      .from("periods")
      .select(PERIOD + ", period_members(count)")
      .eq("group_id", groupId)
      .order("start_date", { ascending: false });
    ensure(error);
    const rows = (data ?? []) as unknown as (PeriodRow & { period_members: { count: number }[] })[];
    const settled = await settledIds(rows.map((row) => row.id));
    return rows.map((row) => {
      const { groupId: _ignored, ...period } = toPeriod(row, settled.has(row.id), row.period_members?.[0]?.count ?? 0);
      return period;
    });
  },

  async getPeriod(id) {
    const { data, error } = await db().from("periods").select(PERIOD + ", period_members(count)").eq("id", id).maybeSingle();
    ensure(error);
    if (!data) return null;
    const row = data as unknown as PeriodRow & { period_members: { count: number }[] };
    return toPeriod(row, (await settledIds([row.id])).has(row.id), row.period_members?.[0]?.count ?? 0);
  },

  async createPeriod(groupId, input) {
    const { error } = await db().from("periods").insert({
      group_id: groupId,
      name: input.name,
      start_date: input.startDate,
      end_date: input.endDate,
      fixed_member_fee: input.fixedMemberFee,
      guest_fee_per_session: input.guestFeePerSession,
      note: input.note,
      status: "draft",
    });
    if (error) throw periodError(error);
  },

  async updatePeriod(id, input) {
    const { error } = await db()
      .from("periods")
      .update({
        name: input.name,
        start_date: input.startDate,
        end_date: input.endDate,
        fixed_member_fee: input.fixedMemberFee,
        guest_fee_per_session: input.guestFeePerSession,
        note: input.note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw periodError(error);
  },

  async setPeriodStatus(id, status) {
    const { error } = await db().from("periods").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw periodError(error);
  },

  async getRoster(period, groupId) {
    const [members, people] = await Promise.all([
      db()
        .from("period_members")
        .select("id, person_id, status, shuttle_discount_percent, person:people(full_name, nickname, avatar_url)")
        .eq("period_id", period.id),
      db()
        .from("person_groups")
        .select("person:people!inner(id, full_name, nickname, attendance_type, status)")
        .eq("group_id", groupId)
        .eq("status", "active")
        .eq("person.status", "active"),
    ]);
    ensure(members.error);
    ensure(people.error);
    const memberRows = (members.data ?? []) as unknown as {
      id: string;
      person_id: string;
      status: PeriodMemberRow["status"];
      shuttle_discount_percent: number | null;
      person: { full_name: string; nickname: string | null; avatar_url: string | null } | null;
    }[];
    const inPeriod = new Set(memberRows.map((row) => row.person_id));
    const order = { fixed: 0, guest: 1, inactive: 2 } as const;
    const { groupId: _ignored, ...plain } = period as AdminPeriod & { groupId?: string | null };
    return {
      period: plain,
      members: memberRows
        .map(
          (row): PeriodMemberRow => ({
            id: row.id,
            personId: row.person_id,
            name: row.person?.nickname || row.person?.full_name || "Thành viên",
            avatarUrl: row.person?.avatar_url ?? null,
            status: row.status,
            discountPercent: ([0, 50, 100].includes(Number(row.shuttle_discount_percent)) ? Number(row.shuttle_discount_percent) : 0) as ShuttleDiscount,
          }),
        )
        .sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name, "vi")),
      candidates: ((people.data ?? []) as unknown as {
        person: { id: string; full_name: string; nickname: string | null; attendance_type: string };
      }[])
        .map(({ person }) => person)
        .filter((person) => !inPeriod.has(person.id))
        .map((person) => ({
          id: person.id,
          name: person.nickname || person.full_name,
          attendanceType: person.attendance_type === "fixed" ? ("fixed" as const) : ("guest" as const),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "vi")),
    };
  },

  async addPeriodMembers(periodId, personIds) {
    const { data, error } = await db().rpc("v2_add_period_members", { p_period_id: periodId, p_person_ids: personIds });
    if (error) throw periodError(error);
    const result = (data ?? {}) as { added?: number; skipped?: number; fees_created?: number };
    return { added: result.added ?? 0, skipped: result.skipped ?? 0, feesCreated: result.fees_created ?? 0 };
  },

  async getPeriodMemberPeriodId(memberId) {
    const { data, error } = await db().from("period_members").select("period_id").eq("id", memberId).maybeSingle();
    ensure(error);
    return (data?.period_id as string | undefined) ?? null;
  },

  async updatePeriodMember(memberId, status, discount) {
    const { data, error } = await db().rpc("v2_update_period_member", {
      p_member_id: memberId,
      p_status: status,
      p_discount: discount,
    });
    if (error) throw periodError(error);
    const action = (data as { action?: string } | null)?.action;
    return (["fee_created", "fee_cancelled", "fee_paid_refund_needed"].includes(action ?? "") ? action : "none") as FeeAction;
  },
};
