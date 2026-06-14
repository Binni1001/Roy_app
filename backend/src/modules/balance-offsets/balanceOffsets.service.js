import { balanceOffsetsRepository } from "./balanceOffsets.repository.js";

function isMissingRpc(error) {
  return error?.code === "PGRST202" || /function .* does not exist/i.test(error?.message || "");
}

export const balanceOffsetsService = {
  async offsetPersonPeriod(personId, periodId) {
    if (!personId) throw new Error("Person ID khong duoc de trong");
    if (!periodId) throw new Error("Period ID khong duoc de trong");

    // Ưu tiên RPC (atomic, có FOR UPDATE lock)
    const rpcResult = await balanceOffsetsRepository.offsetPersonPeriod(
      personId,
      periodId
    );

    if (!rpcResult.error) {
      return rpcResult.data;
    }

    // Fallback JS path (chỉ chạy nếu RPC chưa tồn tại trong DB)
    if (!isMissingRpc(rpcResult.error)) {
      throw new Error(rpcResult.error.message);
    }

    const balanceResult = await balanceOffsetsRepository.getPersonBalance(personId);
    if (balanceResult.error) throw new Error(balanceResult.error.message);

    const balanceRow = balanceResult.data;

    if (!balanceRow || Number(balanceRow.balance) <= 0) {
      return {
        message: "Nguoi nay khong co so du duong de bu tru",
        offset_amount: 0,
        remaining_balance: balanceRow ? Number(balanceRow.balance) : 0,
        updated_debts: []
      };
    }

    let availableBalance = Number(balanceRow.balance);

    const debtsResult = await balanceOffsetsRepository.getUnpaidDebts(personId, periodId);
    if (debtsResult.error) throw new Error(debtsResult.error.message);

    const unpaidDebts = debtsResult.data;

    if (unpaidDebts.length === 0) {
      return {
        message: "Khong co cong no unpaid de bu tru",
        offset_amount: 0,
        remaining_balance: availableBalance,
        updated_debts: []
      };
    }

    const updatedDebts = [];
    let totalOffset = 0;

    for (const debt of unpaidDebts) {
      if (availableBalance <= 0) break;

      const debtAmount = Number(debt.amount);
      const offsetAmount = Math.min(availableBalance, debtAmount);
      const remainingDebtAmount = debtAmount - offsetAmount;

      const updatePayload =
        remainingDebtAmount === 0
          ? {
              status: "paid",
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              description: `${debt.description || ""} | Da bu tru bang so du ca nhan`
            }
          : {
              amount: remainingDebtAmount,
              updated_at: new Date().toISOString(),
              description: `${debt.description || ""} | Da bu tru ${offsetAmount}`
            };

      const updateDebtResult = await balanceOffsetsRepository.updateDebt(
        debt.id,
        updatePayload
      );

      if (updateDebtResult.error) {
        throw new Error(updateDebtResult.error.message);
      }

      availableBalance -= offsetAmount;
      totalOffset += offsetAmount;

      updatedDebts.push({
        debt_id: debt.id,
        old_amount: debtAmount,
        offset_amount: offsetAmount,
        remaining_amount: remainingDebtAmount,
        debt: updateDebtResult.data
      });
    }

    if (totalOffset === 0) {
      return {
        message: "Khong co cong no unpaid de bu tru",
        offset_amount: 0,
        remaining_balance: availableBalance,
        updated_debts: []
      };
    }

    const updateBalanceResult = await balanceOffsetsRepository.updateBalance(
      personId,
      availableBalance
    );

    if (updateBalanceResult.error) {
      throw new Error(updateBalanceResult.error.message);
    }

    // FIX #4: ghi balance_transaction riêng cho từng khoản bù trừ (có related_debt_id)
    for (const item of updatedDebts) {
      const transactionResult = await balanceOffsetsRepository.createBalanceTransaction({
        person_id: personId,
        period_id: periodId,
        related_debt_id: item.debt_id,
        transaction_type: "offset_next_period",
        amount: item.offset_amount,
        direction: "minus",
        description: "Bu tru so du ca nhan vao cong no"
      });

      if (transactionResult.error) {
        throw new Error(transactionResult.error.message);
      }
    }

    return {
      message: "Bu tru so du thanh cong",
      offset_amount: totalOffset,
      remaining_balance: availableBalance,
      updated_debts: updatedDebts
    };
  }
};
