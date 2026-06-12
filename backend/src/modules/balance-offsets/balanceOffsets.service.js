import { balanceOffsetsRepository } from "./balanceOffsets.repository.js";

export const balanceOffsetsService = {
  async offsetPersonPeriod(personId, periodId) {
    if (!personId) throw new Error("Person ID không được để trống");
    if (!periodId) throw new Error("Period ID không được để trống");

    const balanceResult = await balanceOffsetsRepository.getPersonBalance(personId);
    if (balanceResult.error) throw new Error(balanceResult.error.message);

    const balanceRow = balanceResult.data;

    if (!balanceRow || Number(balanceRow.balance) <= 0) {
      return {
        message: "Người này không có số dư dương để bù trừ",
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
        message: "Không có công nợ unpaid để bù trừ",
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
              amount: 0,
              status: "paid",
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              description: `${debt.description || ""} | Đã bù trừ bằng số dư cá nhân`
            }
          : {
              amount: remainingDebtAmount,
              updated_at: new Date().toISOString(),
              description: `${debt.description || ""} | Đã bù trừ ${offsetAmount}`
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

    const updateBalanceResult = await balanceOffsetsRepository.updateBalance(
      personId,
      availableBalance
    );

    if (updateBalanceResult.error) {
      throw new Error(updateBalanceResult.error.message);
    }

    const transactionResult =
      await balanceOffsetsRepository.createBalanceTransaction({
        person_id: personId,
        period_id: periodId,
        transaction_type: "offset_next_period",
        amount: totalOffset,
        direction: "minus",
        description: "Bù trừ số dư cá nhân vào công nợ"
      });

    if (transactionResult.error) {
      throw new Error(transactionResult.error.message);
    }

    return {
      message: "Bù trừ số dư thành công",
      offset_amount: totalOffset,
      remaining_balance: availableBalance,
      updated_debts: updatedDebts
    };
  }
};