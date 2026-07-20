import { debtsRepository } from "./debts.repository.js";
import { validateText, validateAmount, assertValid } from "../../utils/validators.js";

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

  async getDebtLedgerByPeriod(periodId) {
    if (!periodId) throw new Error("Period ID khong duoc de trong");

    const periodResult = await debtsRepository.getPeriodById(periodId);
    if (periodResult.error) throw new Error(periodResult.error.message);
    if (!periodResult.data) throw new Error("Period khong ton tai");

    const [periodDebtsResult, outstandingDebtsResult] = await Promise.all([
      debtsRepository.getByPeriodId(periodId),
      debtsRepository.getUnpaidByGroupId(periodResult.data.group_id)
    ]);

    if (periodDebtsResult.error) throw new Error(periodDebtsResult.error.message);
    if (outstandingDebtsResult.error) throw new Error(outstandingDebtsResult.error.message);

    const debtsById = new Map();
    for (const debt of periodDebtsResult.data || []) debtsById.set(debt.id, debt);
    for (const debt of outstandingDebtsResult.data || []) debtsById.set(debt.id, debt);

    return [...debtsById.values()].sort((left, right) => {
      if (left.status === "unpaid" && right.status !== "unpaid") return -1;
      if (left.status !== "unpaid" && right.status === "unpaid") return 1;
      return new Date(right.created_at || 0) - new Date(left.created_at || 0);
    });
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
      throw new Error(`Loai cong no khong hop le. Chi duoc dung: ${allowedDebtTypes.join(", ")}`);
    }

    assertValid(validateAmount(payload.amount, "So tien cong no"));
    assertValid(validateText(payload.description, "Mo ta", 500));

    // Kiểm tra period và person tồn tại
    const periodResult = await debtsRepository.getPeriodById(payload.period_id);
    if (periodResult.error) throw new Error(periodResult.error.message);
    if (!periodResult.data) throw new Error("Period khong ton tai");

    const personResult = await debtsRepository.getPersonById(payload.person_id);
    if (personResult.error) throw new Error(personResult.error.message);
    if (!personResult.data) throw new Error("Person khong ton tai");
    if (personResult.data.status !== "active") {
      throw new Error(`Khong the tao cong no cho nguoi da nghi: ${personResult.data.full_name}`);
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

    if (!payload.status) throw new Error("Trang thai cong no khong duoc de trong");

    if (!allowedStatuses.includes(payload.status)) {
      throw new Error(`Trang thai cong no khong hop le. Chi duoc dung: ${allowedStatuses.join(", ")}`);
    }

    const { data, error } = await debtsRepository.updateStatus(id, payload.status);

    if (error) throw new Error(error.message);
    return data;
  }
};
