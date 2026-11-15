import type { DebtType, DebtTypeLine, FundEntry, FundSummary, FundType, PersonDebts } from "@roy/shared";
import { db } from "./db.ts";
import { ActionError } from "./routes/actions.ts";
import type { MoneyStore } from "./routes/money.ts";
import { ValidationError } from "./routes/profile.ts";
import { supabasePeriods } from "./storePeriods.ts";

type Own = Omit<MoneyStore, "findPerson" | "findOpenPeriod">;
type Named = { full_name: string; nickname: string | null } | null;

function ensure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const nameOf = (p: Named) => p?.nickname || p?.full_name || "Thành viên";
const money = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

const KNOWN: [RegExp, string][] = [
  [/So tien nop phai du thanh toan/i, "Số tiền nộp phải đủ trả các khoản đã chọn."],
  [/Khoan no da tra hoac khong thuoc/i, "Có khoản đã được trả hoặc không thuộc người này. Tải lại."],
  [/Nguoi nop khong hoat dong|Nguoi .* khong hoat dong/i, "Người này đã nghỉ."],
  [/Ky da dong/i, "Kỳ đã đóng, ghi vào kỳ đang mở."],
  [/Ky da chot/i, "Kỳ đã chốt chia tiền cầu, không tạo hay sửa khoản nợ được nữa."],
  [/Chi duoc ghi quy vao ky dang mo/i, "Chỉ ghi quỹ được vào kỳ đang mở."],
  [/khong con so du duong de hoan/i, "Người này không có số dư dương để hoàn."],
  [/So tien hoan vuot qua so du/i, "Số tiền hoàn lớn hơn số dư người này đang có."],
  [/Thanh vien khong ton tai hoac khong hoat dong/i, "Người này đã nghỉ."],
];

function moneyError(error: { code?: string; message: string }): Error {
  const known = KNOWN.find(([pattern]) => pattern.test(error.message));
  if (known) return new ActionError(known[1], 409, "MONEY_RULE");
  if (["PGRST202", "42883"].includes(error.code ?? "")) {
    return new ActionError("Database chưa có hàm thu tiền hoặc hoàn tiền của bản cũ.", 503, "MIGRATION_NEEDED");
  }
  console.error("[money]", error.message);
  return new ActionError(`Database từ chối: ${error.message}`, 409, "MONEY_REFUSED");
}

function summarize(rows: { transaction_type: string; amount: number | string }[]): FundSummary {
  const sum = (type: FundType) => rows.filter((r) => r.transaction_type === type).reduce((a, r) => a + Number(r.amount), 0);
  const income = sum("income");
  const expense = sum("expense");
  const refund = sum("refund");
  const adjustment = sum("adjustment");
  return { income, expense, refund, adjustment, balance: income + adjustment - expense - refund };
}

type DebtRow = {
  id: string;
  person_id: string;
  debt_type: DebtType;
  amount: number | string;
  status: string;
  description: string | null;
  created_at: string;
  person: Named;
  period: { name: string } | null;
};

function groupUnpaid(rows: DebtRow[]): PersonDebts[] {
  const byPerson = new Map<string, PersonDebts>();
  for (const row of rows) {
    if (row.status !== "unpaid") continue;
    const entry = byPerson.get(row.person_id) ?? { personId: row.person_id, name: nameOf(row.person), total: 0, debts: [] };
    entry.total += Number(row.amount);
    entry.debts.push({
      id: row.id,
      type: row.debt_type,
      amount: Number(row.amount),
      description: row.description,
      periodName: row.period?.name ?? "",
      createdAt: row.created_at,
    });
    byPerson.set(row.person_id, entry);
  }
  return [...byPerson.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "vi"));
}

const DEBT_SELECT = "id, person_id, debt_type, amount, status, description, created_at, person:people(full_name, nickname), period:periods!inner(name, group_id)";

/** Truy vấn cho Công nợ & sổ quỹ và Báo cáo kỳ. Tiền đi qua hàm database có sẵn hoặc một câu lệnh đơn. */
export const supabaseMoney: Own = {
  async loadMoney(period, groupId) {
    const [debts, fund, people, balances] = await Promise.all([
      db().from("debts").select(DEBT_SELECT).eq("period.group_id", groupId).eq("status", "unpaid").order("created_at"),
      db()
        .from("club_fund_transactions")
        .select("id, transaction_type, amount, description, created_at, person:people(full_name, nickname)")
        .eq("period_id", period.id)
        .order("created_at", { ascending: false }),
      db()
        .from("person_groups")
        .select("person:people!inner(id, full_name, nickname, status)")
        .eq("group_id", groupId)
        .eq("status", "active")
        .eq("person.status", "active"),
      db().from("person_balances").select("person_id, balance"),
    ]);
    for (const r of [debts, fund, people, balances]) ensure(r.error);
    const unpaid = groupUnpaid((debts.data ?? []) as unknown as DebtRow[]);
    const fundRows = (fund.data ?? []) as unknown as {
      id: string;
      transaction_type: FundType;
      amount: number | string;
      description: string | null;
      created_at: string;
      person: Named;
    }[];
    const balanceOf = new Map((balances.data ?? []).map((b) => [b.person_id as string, Number(b.balance)]));
    return {
      unpaid,
      unpaidTotal: unpaid.reduce((a, p) => a + p.total, 0),
      fund: {
        ...summarize(fundRows),
        entries: fundRows.map(
          (r): FundEntry => ({
            id: r.id,
            type: r.transaction_type,
            amount: Number(r.amount),
            personName: r.person ? nameOf(r.person) : null,
            description: r.description,
            createdAt: r.created_at,
          }),
        ),
      },
      people: ((people.data ?? []) as unknown as { person: { id: string; full_name: string; nickname: string | null } }[])
        .map(({ person }) => ({ id: person.id, name: person.nickname || person.full_name, balance: balanceOf.get(person.id) ?? 0 }))
        .sort((a, b) => a.name.localeCompare(b.name, "vi")),
    };
  },

  async getUnpaidDebt(debtId, groupId) {
    const { data, error } = await db()
      .from("debts")
      .select("person_id, status, period:periods!inner(group_id)")
      .eq("id", debtId)
      .maybeSingle();
    ensure(error);
    const row = data as unknown as { person_id: string; status: string; period: { group_id: string | null } } | null;
    if (!row || row.status !== "unpaid" || row.period.group_id !== groupId) return null;
    return { personId: row.person_id };
  },

  async isActiveInGroup(personId, groupId) {
    const { data, error } = await db()
      .from("person_groups")
      .select("person:people!inner(status)")
      .eq("person_id", personId)
      .eq("group_id", groupId)
      .eq("status", "active")
      .eq("person.status", "active")
      .limit(1);
    ensure(error);
    return (data ?? []).length > 0;
  },

  async collect(periodId, personId, amount, debtIds, note) {
    const { error } = await db().rpc("deposit_fund_atomic", {
      p_period_id: periodId,
      p_person_id: personId,
      p_amount: amount,
      p_debt_ids: debtIds,
      p_description: note,
    });
    if (error) throw moneyError(error);
  },

  async addDebt(periodId, personId, amount, description) {
    const { error } = await db()
      .from("debts")
      .insert({ period_id: periodId, person_id: personId, debt_type: "other", amount, status: "unpaid", description });
    if (error) throw moneyError(error);
  },

  async cancelDebt(debtId) {
    const { data, error } = await db()
      .from("debts")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", debtId)
      .eq("status", "unpaid")
      .select("id");
    if (error) throw moneyError(error);
    return (data ?? []).length > 0;
  },

  async remind(personId, groupId) {
    const { data, error } = await db()
      .from("debts")
      .select("debt_type, amount, description, period:periods!inner(group_id)")
      .eq("person_id", personId)
      .eq("status", "unpaid")
      .eq("period.group_id", groupId);
    ensure(error);
    const debts = (data ?? []) as unknown as { debt_type: string; amount: number | string; description: string | null }[];
    if (!debts.length) return 0;
    const total = debts.reduce((a, d) => a + Number(d.amount), 0);
    // Cùng nội dung với bản cũ (notifications.service.js remindDebt).
    const lines = debts.map((d) => `• ${d.description || d.debt_type}: ${money(Number(d.amount))}`).join("\n");
    const sent = await db()
      .from("notifications")
      .insert({
        person_id: personId,
        kind: "debt_reminder",
        icon: "⚠️",
        title: "Nhắc nhở: Bạn còn khoản nợ chưa thanh toán",
        body: `Tổng cộng ${money(total)}\n${lines}`,
        action: "home",
      });
    ensure(sent.error);
    return debts.length;
  },

  async addExpense(periodId, personId, amount, description) {
    const { error } = await db()
      .from("club_fund_transactions")
      .insert({ period_id: periodId, person_id: personId, transaction_type: "expense", amount, description });
    if (error) throw moneyError(error);
  },

  async refund(periodId, personId, amount, description) {
    const { error } = await db().rpc("refund_person_balance", {
      p_person_id: personId,
      p_period_id: periodId,
      p_amount: amount,
      p_description: description,
    });
    if (error) throw moneyError(error);
  },

  getPeriodForReport: (periodId) => supabasePeriods.getPeriod(periodId),

  async buildReport(period, groupId) {
    const [members, sessions, debts, fund, shuttles, run] = await Promise.all([
      db().from("period_members").select("status").eq("period_id", period.id),
      db().from("badminton_sessions").select("id, guest_attendances(id)").eq("period_id", period.id),
      db().from("debts").select(DEBT_SELECT).eq("period_id", period.id).eq("period.group_id", groupId),
      db().from("club_fund_transactions").select("transaction_type, amount").eq("period_id", period.id),
      db().from("shuttle_expenses").select("total_amount, total_shuttle_count, tube_count, shuttle_per_tube, single_count").eq("period_id", period.id),
      db().from("shuttle_settlement_runs").select("result").eq("period_id", period.id).maybeSingle(),
    ]);
    for (const r of [members, sessions, debts, fund, shuttles, run]) ensure(r.error);
    if (!debts.data) throw new ValidationError("Không đọc được công nợ của kỳ.");

    const debtRows = debts.data as unknown as DebtRow[];
    const types: DebtType[] = ["monthly_fee", "guest_fee", "shuttle_extra", "other"];
    const lines: DebtTypeLine[] = types
      .map((type) => {
        const rows = debtRows.filter((d) => d.debt_type === type && d.status !== "cancelled");
        const sum = (status?: string) => rows.filter((d) => !status || d.status === status).reduce((a, d) => a + Number(d.amount), 0);
        return { type, count: rows.length, total: sum(), paid: sum("paid"), unpaid: sum("unpaid") };
      })
      .filter((line) => line.count > 0);

    const sessionRows = (sessions.data ?? []) as unknown as { guest_attendances: { id: string }[] }[];
    const expenseRows = (shuttles.data ?? []) as unknown as {
      total_amount: number | string;
      total_shuttle_count: number | null;
      tube_count: number;
      shuttle_per_tube: number;
      single_count: number;
    }[];
    const details = ((run.data?.result as { preview_details?: { net_amount?: number }[] } | null)?.preview_details ?? []).map((d) =>
      Number(d.net_amount ?? 0),
    );

    return {
      period,
      fixedCount: (members.data ?? []).filter((m) => m.status === "fixed").length,
      guestCount: sessionRows.reduce((a, s) => a + s.guest_attendances.length, 0),
      sessionCount: sessionRows.length,
      debts: lines,
      cancelledTotal: debtRows.filter((d) => d.status === "cancelled").reduce((a, d) => a + Number(d.amount), 0),
      fund: summarize((fund.data ?? []) as { transaction_type: string; amount: number }[]),
      shuttles: {
        purchases: expenseRows.length,
        shuttles: expenseRows.reduce((a, e) => a + (e.total_shuttle_count ?? e.tube_count * e.shuttle_per_tube + e.single_count), 0),
        personalAmount: expenseRows.reduce((a, e) => a + Number(e.total_amount), 0),
      },
      settlement: {
        settled: Boolean(run.data),
        positive: { count: details.filter((n) => n > 0).length, total: details.filter((n) => n > 0).reduce((a, n) => a + n, 0) },
        negative: { count: details.filter((n) => n < 0).length, total: -details.filter((n) => n < 0).reduce((a, n) => a + n, 0) },
      },
      unpaid: groupUnpaid(debtRows),
    };
  },
};
