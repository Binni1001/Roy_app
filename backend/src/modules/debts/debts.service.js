import { debtsRepository } from "./debts.repository.js";

const allowedDebtTypes = ["monthly_fee", "guest_fee", "shuttle_extra", "other"];
const allowedStatuses = ["unpaid", "paid", "cancelled"];

export const debtsService = {
  async getAllDebts() {
    const { data, error } = await debtsRepository.getAll();
    if (error) throw new Error(error.message);
    return data;
  },

  async getDebtsByPeriod(periodId) {
    if (!periodId) throw new Error("Period ID khong duoc de trong");

    const { data, error } = await debtsRepository.getByPeriodId(periodId);
    if (error) throw new Error(error.message);
    return data;
  },

  async getDebtsByPerson(personId) {
    if (!personId) throw new Error("Person ID khong duoc de trong");

    const { data, error } = await debtsRepository.getByPersonId(personId);
    if (error) throw new Error(error.message);
    return data;
  },

  async createDebt(payload = {}) {
    if (!payload.period_id) throw new Error("Period ID khong duoc de trong");
    if (!payload.person_id) throw new Error("Person ID khong duoc de trong");

    if (!allowedDebtTypes.includes(payload.debt_type)) {
      throw new Error("Loai cong no khong hop le");
    }

    if (Number(payload.amount) <= 0) {
      throw new Error("Sa tien cong no phai lon hon 0");
    }

    const { data, error } = await debtsRepository.create({
      period_id: payload.period_id,
      person_id: payload.person_id,
      debt_type: payload.debt_type,
      amount: Number(payload.amount),
      status: payload.status || "unpaid",
      description: payload.description || null
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async updateDebtStatus(id, payload = {}) {
    if (!id) throw new Error("Debt ID khong duoc de trong");

    if (!allowedStatuses.includes(payload.status)) {
      throw new Error("Trang thii cong no khong hop le");
    }

    const { data, error } = await debtsRepository.updateStatus(id, payload.status);

    if (error) throw new Error(error.message);
    return data;
  }
};