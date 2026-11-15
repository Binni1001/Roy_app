import type { AdminShuttleLoan, BlockingItem, BuyType, SettlementLine, ShuttleExpense } from "@roy/shared";
import { db } from "./db.ts";
import { buildLegacyFixedBoard, type LegacyMatch } from "./domain/legacyBoard.ts";
import { ActionError } from "./routes/actions.ts";
import { FIXED_POINTS_RULE } from "./routes/arena.ts";
import type { ShuttleStore } from "./routes/shuttles.ts";

type Own = Omit<ShuttleStore, "findPerson" | "findOpenPeriod">;

function ensure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const KNOWN: [RegExp, string][] = [
  [/Ky da chot/i, "Kỳ đã chốt chia tiền cầu, không đổi được nữa."],
  [/Nguoi mua phai la thanh vien co dinh/i, "Người mua cầu phải là thành viên cố định đang hoạt động của kỳ."],
  [/So tien mua cau khong hop le/i, "Số tiền mua cầu không hợp lệ."],
  [/Can thu het cong no va tien muon cau/i, "Cần thu hết công nợ và tiền mượn cầu trước khi dùng quỹ dư."],
  [/So tien vuot quy du/i, "Số tiền vượt quá quỹ dư."],
  [/Chi duoc dung quy du truoc khi chot/i, "Chỉ dùng quỹ dư được trước khi chốt chia tiền cầu."],
  [/Ky chua co thanh vien co dinh/i, "Kỳ chưa có thành viên cố định."],
  [/Can it nhat mot thanh vien chiu tien cau/i, "Cần ít nhất một thành viên chịu tiền cầu (không miễn 100%)."],
  [/Chi phi da bu tu quy/i, "Lần mua này đã được quỹ bù nên không xóa được."],
  [/Ket qua tran vua thay doi/i, "Kết quả trận vừa thay đổi. Tải lại rồi đóng kỳ lại."],
];

function shuttleError(error: { code?: string; message: string }): Error {
  const known = KNOWN.find(([pattern]) => pattern.test(error.message));
  if (known) return new ActionError(known[1], 409, "SHUTTLE_RULE");
  if (["PGRST202", "42883", "42P01"].includes(error.code ?? "")) {
    return new ActionError("Database chưa có hàm tiền cầu (migration 20261006_shuttle_closeout_and_loans.sql).", 503, "MIGRATION_NEEDED");
  }
  // Thông báo của database bằng tiếng Việt không dấu, vẫn hiện cho owner để biết lý do.
  console.error("[shuttles]", error.message);
  return new ActionError(`Database từ chối: ${error.message}`, 409, "SHUTTLE_REFUSED");
}

const money = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

/** Lời thông báo sau khi chốt, giống bản cũ (shuttleSettlements.service.js). */
function settlementMessage(net: number, result: { action?: string; remaining_amount?: number; offset?: { offset_amount?: number; remaining_balance?: number } }) {
  const credited = Math.max(0, net);
  const offset = Number(result.offset?.offset_amount ?? 0);
  const remaining = Number(result.offset?.remaining_balance ?? credited);
  if (net > 0 && offset > 0) return `Bạn được cộng ${money(credited)}; ${money(offset)} đã tự bù công nợ. Số dư còn lại ${money(remaining)}.`;
  if (net > 0) return `Bạn được cộng ${money(credited)} do đã mua cầu nhiều hơn phần chịu.`;
  if (net < 0 && result.action === "paid_by_balance") return `Khoản tiền cầu ${money(-net)} đã được thanh toán bằng số dư của bạn.`;
  if (net < 0 && result.action === "partially_paid_by_balance") {
    return `Số dư đã tự bù một phần tiền cầu; bạn còn cần nộp ${money(Number(result.remaining_amount ?? 0))}.`;
  }
  if (net < 0) return `Bạn cần nộp thêm ${money(-net)} tiền cầu kỳ này.`;
  return "Tiền cầu của bạn đã huề, không cần nộp thêm.";
}

const MATCH_SELECT =
  "match_type, status, voided_at, winner_side, set_scores, challenger_id, challenger_partner_id, opponent_id, opponent_partner_id, " +
  "challenger:people!challenger_id(id, full_name, nickname, avatar_url), " +
  "challenger_partner:people!challenger_partner_id(id, full_name, nickname, avatar_url), " +
  "opponent:people!opponent_id(id, full_name, nickname, avatar_url), " +
  "opponent_partner:people!opponent_partner_id(id, full_name, nickname, avatar_url)";

/** Trận được tính vào bảng, đọc theo trang như bản cũ (getRankingMatches). */
export async function rankingMatches(periodId: string): Promise<LegacyMatch[]> {
  const rows: LegacyMatch[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db()
      .from("pk_matches")
      .select(MATCH_SELECT)
      .eq("period_id", periodId)
      .eq("status", "completed")
      .is("voided_at", null)
      .order("id")
      .range(start, start + 999);
    ensure(error);
    rows.push(...((data ?? []) as unknown as LegacyMatch[]));
    if ((data ?? []).length < 1000) return rows;
  }
}

/** Truy vấn cho màn hình Tiền cầu & chốt kỳ. Mọi thao tác tiền gọi hàm database có sẵn của bản cũ. */
export const supabaseShuttles: Own = {
  async loadShuttleOverview(period, groupId) {
    const [expenses, loans, members, people, preview, readiness, rule] = await Promise.all([
      db()
        .from("shuttle_expenses")
        .select("id, buyer_id, buy_type, tube_count, shuttle_per_tube, single_count, total_shuttle_count, total_amount, buy_date, note, buyer:people(full_name, nickname)")
        .eq("period_id", period.id)
        .order("buy_date", { ascending: false }),
      db()
        .from("shuttle_loans")
        .select("id, person_id, quantity, unit_price, amount, borrowed_at, note, status, person:people(full_name, nickname)")
        .eq("period_id", period.id)
        .order("created_at", { ascending: false }),
      db()
        .from("period_members")
        .select("person:people!inner(id, full_name, nickname, status)")
        .eq("period_id", period.id)
        .eq("status", "fixed")
        .eq("person.status", "active"),
      db()
        .from("person_groups")
        .select("person:people!inner(id, full_name, nickname, status)")
        .eq("group_id", groupId)
        .eq("status", "active")
        .eq("person.status", "active"),
      db().rpc("preview_shuttle_period", { p_period_id: period.id }),
      db().rpc("period_finance_readiness", { p_period_id: period.id }),
      db().from("periods").select("pk_scoring_rule").eq("id", period.id).single(),
    ]);
    for (const result of [expenses, loans, members, people, readiness, rule]) ensure(result.error);

    type Named = { full_name: string; nickname: string | null } | null;
    const nameOf = (p: Named) => p?.nickname || p?.full_name || "Thành viên";
    const pick = (rows: unknown) =>
      ((rows ?? []) as { person: { id: string; full_name: string; nickname: string | null } }[])
        .map(({ person }) => ({ id: person.id, name: person.nickname || person.full_name }))
        .sort((a, b) => a.name.localeCompare(b.name, "vi"));

    const p = (preview.data ?? {}) as Record<string, unknown>;
    const details = (Array.isArray(p.details) ? p.details : []) as {
      person_id: string;
      person?: Named;
      shuttle_discount_percent?: number;
      paid_for_shuttles?: number;
      shuttle_share?: number;
      net_amount?: number;
    }[];
    const unpaid = (Array.isArray(p.unpaid_before_settlement) ? p.unpaid_before_settlement : []) as {
      kind: string;
      person_name: string;
      period_name: string;
      amount: number;
    }[];
    const r = (readiness.data ?? {}) as { can_close?: boolean };

    return {
      expenses: ((expenses.data ?? []) as unknown as {
        id: string;
        buyer_id: string;
        buy_type: BuyType;
        tube_count: number;
        shuttle_per_tube: number;
        single_count: number;
        total_shuttle_count: number | null;
        total_amount: number | string;
        buy_date: string;
        note: string | null;
        buyer: Named;
      }[]).map(
        (e): ShuttleExpense => ({
          id: e.id,
          buyerId: e.buyer_id,
          buyerName: nameOf(e.buyer),
          buyType: e.buy_type,
          tubeCount: e.tube_count,
          shuttlePerTube: e.shuttle_per_tube,
          singleCount: e.single_count,
          shuttleCount: e.total_shuttle_count ?? e.tube_count * e.shuttle_per_tube + e.single_count,
          amount: Number(e.total_amount ?? 0),
          buyDate: e.buy_date,
          note: e.note,
        }),
      ),
      loans: ((loans.data ?? []) as unknown as {
        id: string;
        person_id: string;
        quantity: number;
        unit_price: number | string;
        amount: number | string | null;
        borrowed_at: string;
        note: string | null;
        status: string;
        person: Named;
      }[]).map(
        (l): AdminShuttleLoan => ({
          id: l.id,
          personId: l.person_id,
          personName: nameOf(l.person),
          quantity: l.quantity,
          unitPrice: Number(l.unit_price),
          amount: Number(l.amount ?? l.quantity * Number(l.unit_price)),
          borrowedAt: l.borrowed_at,
          note: l.note,
          status: l.status,
        }),
      ),
      buyers: pick(members.data),
      people: pick(people.data),
      settlement: {
        settled: p.settled === true,
        totalAmount: Number(p.total_shuttle_amount ?? 0),
        totalShuttles: Number(p.total_shuttle_count ?? 0),
        memberCount: Number(p.fixed_member_count ?? 0),
        lines: details
          .map(
            (d): SettlementLine => ({
              personId: d.person_id,
              name: nameOf(d.person ?? null),
              discountPercent: Number(d.shuttle_discount_percent ?? 0),
              paid: Number(d.paid_for_shuttles ?? 0),
              share: Number(d.shuttle_share ?? 0),
              net: Number(d.net_amount ?? 0),
            }),
          )
          .sort((a, b) => b.net - a.net || a.name.localeCompare(b.name, "vi")),
        fundBalance: Number(p.fund_balance ?? 0),
        blocking: unpaid.map(
          (u): BlockingItem => ({
            kind: u.kind === "shuttle_loan" ? "shuttle_loan" : "debt",
            personName: u.person_name,
            periodName: u.period_name,
            amount: Number(u.amount ?? 0),
          }),
        ),
        canSettle: p.can_settle === true,
        problem: preview.error ? shuttleError(preview.error).message : null,
      },
      canClose: r.can_close === true,
      closeSupported: rule.data?.pk_scoring_rule === FIXED_POINTS_RULE,
    };
  },

  async createExpense(periodId, input) {
    const { error } = await db().rpc("create_shuttle_expense_with_fund", {
      p_payload: {
        period_id: periodId,
        buyer_id: input.buyerId,
        buy_type: input.buyType,
        tube_count: input.tubeCount,
        shuttle_per_tube: input.shuttlePerTube,
        single_count: input.singleCount,
        personal_amount: input.totalPrice - input.fundAmount,
        fund_amount: input.fundAmount,
        buy_date: input.buyDate,
        note: input.note,
      },
    });
    if (error) throw shuttleError(error);
  },

  async getExpensePeriodId(id) {
    const { data, error } = await db().from("shuttle_expenses").select("period_id").eq("id", id).maybeSingle();
    ensure(error);
    return (data?.period_id as string | undefined) ?? null;
  },

  async deleteExpense(id) {
    const { error } = await db().from("shuttle_expenses").delete().eq("id", id);
    if (error) throw shuttleError(error);
  },

  async createLoan(periodId, input) {
    const { error } = await db().rpc("create_shuttle_loan", {
      p_period_id: periodId,
      p_person_id: input.personId,
      p_quantity: input.quantity,
      p_unit_price: input.unitPrice,
      p_borrowed_at: input.borrowedAt,
      p_note: input.note,
    });
    if (error) throw shuttleError(error);
  },

  async getLoanPeriodId(id) {
    const { data, error } = await db().from("shuttle_loans").select("period_id").eq("id", id).maybeSingle();
    ensure(error);
    return (data?.period_id as string | undefined) ?? null;
  },

  async changeLoan(id, action) {
    const { error } = await db().rpc(action === "repay" ? "repay_shuttle_loan" : "cancel_shuttle_loan", { p_id: id });
    if (error) throw shuttleError(error);
  },

  async applyFund(periodId, buyerId, amount) {
    const { error } = await db().rpc("apply_fund_to_shuttles", { p_period_id: periodId, p_buyer_id: buyerId, p_amount: amount });
    if (error) throw shuttleError(error);
  },

  async settle(periodId, periodName) {
    const preview = await db().rpc("preview_shuttle_period", { p_period_id: periodId });
    if (preview.error) throw shuttleError(preview.error);
    const p = (preview.data ?? {}) as { settled?: boolean; can_settle?: boolean };
    if (p.settled) throw new ActionError("Kỳ này đã chốt chia tiền cầu.", 409, "ALREADY_SETTLED");
    if (!p.can_settle) {
      throw new ActionError("Cần thu hết công nợ và tiền mượn cầu, đưa quỹ về 0 trước khi chốt.", 409, "NOT_READY");
    }
    const { data, error } = await db().rpc("settle_shuttle_period", { p_period_id: periodId });
    if (error) throw shuttleError(error);

    const result = (data ?? {}) as {
      preview_details?: { person_id: string; net_amount?: number }[];
      results?: { person_id: string; action?: string; remaining_amount?: number; offset?: { offset_amount?: number; remaining_balance?: number } }[];
    };
    const byPerson = new Map((result.results ?? []).map((row) => [row.person_id, row]));
    const notifications = (result.preview_details ?? []).map((detail) => {
      const net = Number(detail.net_amount ?? 0);
      return {
        person_id: detail.person_id,
        kind: "shuttle_settled",
        icon: net > 0 ? "💰" : net < 0 ? "⚠️" : "✅",
        title: `Chốt tiền cầu — ${periodName}`,
        body: settlementMessage(net, byPerson.get(detail.person_id) ?? {}),
        action: "home",
      };
    });
    if (notifications.length) {
      const sent = await db().from("notifications").insert(notifications);
      if (sent.error) console.error("[settle notifications]", sent.error.message);
    }
  },

  async getScoringRule(periodId) {
    const { data, error } = await db().from("periods").select("pk_scoring_rule").eq("id", periodId).maybeSingle();
    ensure(error);
    return (data?.pk_scoring_rule as string | undefined) ?? null;
  },

  async closePeriod(periodId) {
    const readiness = await db().rpc("period_finance_readiness", { p_period_id: periodId });
    if (readiness.error) throw shuttleError(readiness.error);
    if (!(readiness.data as { can_close?: boolean } | null)?.can_close) {
      throw new ActionError("Cần chốt chia tiền cầu, trả hết tiền mượn cầu và đưa quỹ về 0 trước khi đóng kỳ.", 409, "NOT_READY_TO_CLOSE");
    }
    const signature = await db().rpc("pk_ranking_source_signature", { p_period_id: periodId });
    if (signature.error) throw shuttleError(signature.error);
    const matches = await rankingMatches(periodId);
    const boards = Object.fromEntries(
      (["singles", "doubles"] as const).map((type) => [type, { period_id: periodId, match_type: type, ...buildLegacyFixedBoard(matches, type) }]),
    );
    const { error } = await db().rpc("close_period_with_pk_history", {
      p_period_id: periodId,
      p_patch: {},
      p_expected_signature: signature.data,
      p_boards: boards,
    });
    if (error) throw shuttleError(error);
  },
};
