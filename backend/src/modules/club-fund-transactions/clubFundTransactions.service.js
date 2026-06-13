import { clubFundTransactionsRepository } from "./clubFundTransactions.repository.js";

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
    if (!allowedTypes.includes(payload.transaction_type)) {
      throw new Error("Loai giao dich quy khong hop le");
    }

    if (Number(payload.amount) <= 0) {
      throw new Error("Sa tien phai lon hon 0");
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
  }
};