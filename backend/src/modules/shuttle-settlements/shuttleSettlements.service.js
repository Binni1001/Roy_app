import { shuttleSettlementsRepository } from "./shuttleSettlements.repository.js";

function isMissingRpc(error) {
  return error?.code === "PGRST202" || /function .* does not exist/i.test(error?.message || "");
}

export const shuttleSettlementsService = {
  async preview(periodId) {
    if (!periodId) {
      throw new Error("Period ID khong duoc de trong");
    }

    // Check period tồn tại và đã open (không preview trên draft)
    const periodResult = await shuttleSettlementsRepository.getPeriodById(periodId);
    if (periodResult.error) throw new Error(periodResult.error.message);
    if (!periodResult.data) throw new Error("Period khong ton tai");
    if (periodResult.data.status === "draft") {
      throw new Error("Ky nay chua mo, khong the xem preview chot cau");
    }

    const membersResult = await shuttleSettlementsRepository.getFixedMembers(periodId);
    if (membersResult.error) throw new Error(membersResult.error.message);

    const fixedMembers = membersResult.data;

    if (fixedMembers.length === 0) {
      throw new Error("Ky nay chua co fixed member");
    }

    const expensesResult = await shuttleSettlementsRepository.getShuttleExpenses(periodId);
    if (expensesResult.error) throw new Error(expensesResult.error.message);

    const expenses = expensesResult.data;

    const totalAmount = expenses.reduce(
      (sum, item) => sum + Number(item.total_amount),
      0
    );

    const totalShuttles = expenses.reduce(
      (sum, item) => sum + Number(item.total_shuttle_count),
      0
    );

    const sharePerMember = Math.round(totalAmount / fixedMembers.length);

    const buyerMap = {};

    for (const expense of expenses) {
      const buyerId = expense.buyer_id;

      if (!buyerMap[buyerId]) {
        buyerMap[buyerId] = 0;
      }

      buyerMap[buyerId] += Number(expense.total_amount);
    }

    const details = fixedMembers.map((member) => {
      const personId = member.person_id;
      const paidForShuttles = buyerMap[personId] || 0;
      const netAmount = paidForShuttles - sharePerMember;

      return {
        person_id: personId,
        person: member.person,
        paid_for_shuttles: paidForShuttles,
        shuttle_share: sharePerMember,
        net_amount: netAmount,
        result:
          netAmount > 0
            ? "positive_balance"
            : netAmount < 0
              ? "need_to_pay"
              : "settled"
      };
    });

    return {
      period_id: periodId,
      fixed_member_count: fixedMembers.length,
      total_shuttle_amount: totalAmount,
      total_shuttle_count: totalShuttles,
      share_per_member: sharePerMember,
      details
    };
  },

  async settle(periodId) {
    if (!periodId) {
      throw new Error("Period ID khong duoc de trong");
    }

    // Ưu tiên RPC (atomic, có idempotency check + period status check bên trong)
    const rpcResult = await shuttleSettlementsRepository.settlePeriod(periodId);

    if (!rpcResult.error) {
      // Gửi notification cho từng thành viên sau khi chốt
      const rpcData = rpcResult.data || {};
      const details = rpcData.preview_details || [];
      if (details.length > 0) {
        const periodInfo = await shuttleSettlementsRepository.getPeriodById(periodId);
        const periodName = periodInfo.data?.name || "kỳ này";
        const notifications = details.map((d) => ({
          person_id: d.person_id,
          kind: "shuttle_settled",
          icon: d.net_amount > 0 ? "💰" : d.net_amount < 0 ? "⚠️" : "✅",
          title: `Chốt tiền cầu — ${periodName}`,
          body: d.net_amount > 0
            ? `Bạn được hoàn lại ${Math.abs(d.net_amount).toLocaleString("vi-VN")}đ do đã mua cầu nhiều hơn phần chịu.`
            : d.net_amount < 0
              ? `Bạn cần nộp thêm ${Math.abs(d.net_amount).toLocaleString("vi-VN")}đ tiền cầu kỳ này.`
              : "Tiền cầu của bạn đã huề, không cần thêm.",
          action: "home",
        }));
        await shuttleSettlementsRepository.createNotifications(notifications).catch(() => {});
      }
      return rpcResult.data;
    }

    // Fallback JS path (chỉ chạy nếu RPC chưa tồn tại trong DB)
    if (!isMissingRpc(rpcResult.error)) {
      throw new Error(rpcResult.error.message);
    }

    // Idempotency check
    const existingSettlementResult =
      await shuttleSettlementsRepository.getSettlementTransactions(periodId);

    if (existingSettlementResult.error) {
      throw new Error(existingSettlementResult.error.message);
    }

    if ((existingSettlementResult.data || []).length > 0) {
      throw new Error("Ky nay da chot tien cau roi");
    }

    const preview = await this.preview(periodId);

    const results = [];

    for (const item of preview.details) {
      const netAmount = Number(item.net_amount);

      if (netAmount === 0) {
        results.push({
          person_id: item.person_id,
          action: "no_action",
          amount: 0
        });
        continue;
      }

      const balanceResult = await shuttleSettlementsRepository.findPersonBalance(
        item.person_id
      );

      if (balanceResult.error) {
        throw new Error(balanceResult.error.message);
      }

      const currentBalance = balanceResult.data
        ? Number(balanceResult.data.balance)
        : 0;

      const newBalance = currentBalance + netAmount;

      if (balanceResult.data) {
        const updateBalanceResult =
          await shuttleSettlementsRepository.updatePersonBalance(
            item.person_id,
            newBalance
          );

        if (updateBalanceResult.error) {
          throw new Error(updateBalanceResult.error.message);
        }
      } else {
        const createBalanceResult =
          await shuttleSettlementsRepository.createPersonBalance(
            item.person_id,
            newBalance
          );

        if (createBalanceResult.error) {
          throw new Error(createBalanceResult.error.message);
        }
      }

      const transactionResult =
        await shuttleSettlementsRepository.createBalanceTransaction({
          person_id: item.person_id,
          period_id: periodId,
          transaction_type:
            netAmount > 0
              ? "credit_from_shuttle_purchase"
              : "debit_shuttle_share",
          amount: Math.abs(netAmount),
          direction: netAmount > 0 ? "plus" : "minus",
          description:
            netAmount > 0
              ? "Duong tien do mua cau nhieu hon phan phai chiu"
              : "Am tien do chua dong du phan cau phai chiu"
        });

      if (transactionResult.error) {
        throw new Error(transactionResult.error.message);
      }

      if (netAmount < 0) {
        const debtResult = await shuttleSettlementsRepository.createDebt({
          period_id: periodId,
          person_id: item.person_id,
          debt_type: "shuttle_extra",
          amount: Math.abs(netAmount),
          status: "unpaid",
          description: "Tien cau can dong them"
        });

        if (debtResult.error) {
          throw new Error(debtResult.error.message);
        }

        results.push({
          person_id: item.person_id,
          action: "created_shuttle_debt",
          amount: Math.abs(netAmount),
          new_balance: newBalance,
          debt: debtResult.data
        });
      } else {
        results.push({
          person_id: item.person_id,
          action: "added_positive_balance",
          amount: netAmount,
          new_balance: newBalance
        });
      }
    }

    return {
      message: "Chot tien cau thanh cong",
      preview,
      results
    };
  }
};
