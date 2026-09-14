import { balanceOffsetsRepository } from "./balanceOffsets.repository.js";
import { assertPeopleActive } from "../../utils/peopleGuard.js";
import { annotateActivityPeople } from "../../utils/activityEligibilityDb.js";

function isMissingRpc(error) {
  return error?.code === "PGRST202" || /function .* does not exist/i.test(error?.message || "");
}

export const balanceOffsetsService = {
  async offsetAll() {
    const balancesResult = await balanceOffsetsRepository.getPositiveBalances();
    if (balancesResult.error) throw new Error(balancesResult.error.message);

    const rows = balancesResult.data || [];
    const people = await annotateActivityPeople(rows.map((row) => row.person));
    const eligibleIds = new Set(people.filter((person) => person.activity_eligible).map((person) => person.id));
    const positives = rows.filter((row) => eligibleIds.has(row.person_id));
    let totalOffset = 0;
    let affectedPeople = 0;

    for (const row of positives) {
      const result = await this.offsetPerson(row.person_id);
      const offset = Number(result?.offset_amount || 0);
      if (offset > 0) {
        totalOffset += offset;
        affectedPeople += 1;
      }
    }

    return {
      message: affectedPeople > 0
        ? `Da bu tru cho ${affectedPeople} nguoi, tong ${totalOffset}d`
        : "Khong co so du duong nao can bu tru vao cong no",
      total_offset: totalOffset,
      affected_people: affectedPeople,
    };
  },

  async offsetAllForPeriod(periodId) {
    if (!periodId) throw new Error("Period ID khong duoc de trong");
    return this.offsetAll();
  },

  async offsetPerson(personId) {
    if (!personId) throw new Error("Person ID khong duoc de trong");
    await assertPeopleActive([personId]);

    const rpcResult = await balanceOffsetsRepository.offsetPerson(personId);

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

    const debtsResult = await balanceOffsetsRepository.getUnpaidDebts(personId);
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
        period_id: item.debt.period_id,
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
  },

  async offsetPersonPeriod(personId, periodId) {
    if (!periodId) throw new Error("Period ID khong duoc de trong");
    return this.offsetPerson(personId);
  }
};
