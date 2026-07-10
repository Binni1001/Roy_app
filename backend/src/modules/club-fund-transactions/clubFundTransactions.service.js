import { clubFundTransactionsRepository } from "./clubFundTransactions.repository.js";
import { debtsRepository } from "../debts/debts.repository.js";
import { validateAmount, validateText, assertValid } from "../../utils/validators.js";
import { assertPeopleActive } from "../../utils/peopleGuard.js";

const allowedTypes = ["income", "expense", "refund", "adjustment"];

export const clubFundTransactionsService = {
  async getAll() {
    const { data, error } = await clubFundTransactionsRepository.getAll();
    if (error) throw new Error(error.message);
    return data;
  },

  async getByPeriod(periodId) {
    if (!periodId) throw new Error("Period ID khong duoc de trong");

    const { data, error } = await clubFundTransactionsRepository.getByPeriod(periodId);
    if (error) throw new Error(error.message);
    return data;
  },

  async create(payload = {}) {
    if (!payload.transaction_type) {
      throw new Error("Loai giao dich quy khong duoc de trong");
    }

    if (!allowedTypes.includes(payload.transaction_type)) {
      throw new Error(`Loai giao dich quy khong hop le. Chi duoc dung: ${allowedTypes.join(", ")}`);
    }

    assertValid(validateAmount(payload.amount, "So tien giao dich quy"));
    assertValid(validateText(payload.description, "Mo ta giao dich", 500));

    if (payload.person_id) {
      await assertPeopleActive([payload.person_id]);
    }

    const { data, error } = await clubFundTransactionsRepository.create({
      period_id: payload.period_id || null,
      person_id: payload.person_id || null,
      payment_id: payload.payment_id || null,
      transaction_type: payload.transaction_type,
      amount: Number(payload.amount),
      description: payload.description || null
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, payload = {}) {
    if (!id) throw new Error("ID giao dịch không được để trống");
    const allowed = {};
    if (payload.transaction_type !== undefined) {
      if (!allowedTypes.includes(payload.transaction_type)) throw new Error("Loại giao dịch không hợp lệ");
      allowed.transaction_type = payload.transaction_type;
    }
    if (payload.amount !== undefined) {
      assertValid(validateAmount(payload.amount, "Số tiền"));
      allowed.amount = Number(payload.amount);
    }
    if (payload.description !== undefined) {
      assertValid(validateText(payload.description, "Mô tả", 500));
      allowed.description = payload.description || null;
    }
    const { data, error } = await clubFundTransactionsRepository.update(id, allowed);
    if (error) throw new Error(error.message);
    return data;
  },

  async remove(id) {
    if (!id) throw new Error("ID giao dịch không được để trống");
    const { error } = await clubFundTransactionsRepository.remove(id);
    if (error) throw new Error(error.message);
    return { id };
  },

  // Hoàn tiền cho 1 người: ghi khoản 'refund' (giảm quỹ) VÀ trừ luôn số dư của họ
  // => một thao tác đưa số dư về 0 (dùng cho người mua cầu nhiều CLB nợ lại).
  async refundPerson(payload = {}) {
    if (!payload.person_id) throw new Error("Vui long chon nguoi can hoan tien");
    assertValid(validateAmount(payload.amount, "So tien hoan"));
    assertValid(validateText(payload.description, "Ly do hoan tien", 500));

    await assertPeopleActive([payload.person_id]);

    const amount = Number(payload.amount);

    // 1) Ghi khoản hoàn tiền -> giảm quỹ
    const fundResult = await clubFundTransactionsRepository.create({
      period_id: payload.period_id || null,
      person_id: payload.person_id,
      payment_id: null,
      transaction_type: "refund",
      amount,
      description: payload.description || "Hoan tien cho nguoi mua cau nhieu"
    });
    if (fundResult.error) throw new Error(fundResult.error.message);

    // 2) Trừ số dư cá nhân (CLB đã trả bớt phần nợ họ) -> số dư về đúng
    const balanceResult = await clubFundTransactionsRepository.getPersonBalance(payload.person_id);
    if (balanceResult.error) throw new Error(balanceResult.error.message);

    let newBalance = null;
    if (balanceResult.data) {
      newBalance = Number(balanceResult.data.balance) - amount;
      const updateResult = await clubFundTransactionsRepository.setPersonBalance(
        payload.person_id,
        newBalance
      );
      if (updateResult.error) throw new Error(updateResult.error.message);
    }

    return { ...fundResult.data, new_balance: newBalance };
  },

  async deposit(payload = {}) {
    if (!payload.person_id) throw new Error("Vui lòng chọn người nộp quỹ");
    assertValid(validateAmount(payload.amount, "Số tiền nộp quỹ"));
    assertValid(validateText(payload.description, "Mô tả", 500));

    await assertPeopleActive([payload.person_id]);

    const debtIds = Array.isArray(payload.debt_ids) ? payload.debt_ids.filter(Boolean) : [];

    for (const debtId of debtIds) {
      const { error } = await debtsRepository.updateStatus(debtId, "paid");
      if (error) throw new Error(error.message);
    }

    const { data, error } = await clubFundTransactionsRepository.create({
      period_id: payload.period_id || null,
      person_id: payload.person_id,
      payment_id: null,
      transaction_type: "income",
      amount: Number(payload.amount),
      description: payload.description || null
    });

    if (error) throw new Error(error.message);
    return data;
  },
};
