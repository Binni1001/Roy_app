import { clubFundTransactionsRepository } from "./clubFundTransactions.repository.js";
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

  // Database handles debt priority, row locking and both ledgers atomically.
  async refundPerson(payload = {}) {
    if (!payload.person_id) throw new Error("Vui long chon nguoi can hoan tien");
    assertValid(validateAmount(payload.amount, "So tien hoan"));
    assertValid(validateText(payload.description, "Ly do hoan tien", 500));

    await assertPeopleActive([payload.person_id]);

    const { data, error } = await clubFundTransactionsRepository.refundPerson({
      person_id: payload.person_id,
      period_id: payload.period_id || null,
      amount: Number(payload.amount),
      description: payload.description || "Hoan tien so du cho thanh vien"
    });

    if (error) {
      if (error.code === "PGRST202") {
        throw new Error("Database chua chay migration bu tru va hoan tien tu dong");
      }
      throw new Error(error.message);
    }

    return data;
  },

  // Kept as an explicit error for older clients using the former carry-over action.
  async carryOver() {
    throw new Error("Quỹ dư cần bù tiền cầu trước khi chia; chỉ mở kỳ mới khi quỹ kỳ cũ bằng 0.");
  },

  async deposit(payload = {}) {
    if (!payload.person_id) throw new Error("Vui lòng chọn người nộp quỹ");
    assertValid(validateAmount(payload.amount, "Số tiền nộp quỹ"));
    assertValid(validateText(payload.description, "Mô tả", 500));

    await assertPeopleActive([payload.person_id]);

    if (!payload.period_id) throw new Error("Vui lòng chọn kỳ quỹ nhận tiền.");
    const { data, error } = await clubFundTransactionsRepository.depositAtomic(payload);
    if (error) throw new Error(error.code === "PGRST202"
      ? "Cần chạy migration 20261006_shuttle_closeout_and_loans.sql trước khi nộp quỹ." : error.message);
    return data;
  },
};
