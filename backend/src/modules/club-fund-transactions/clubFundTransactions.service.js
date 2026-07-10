import { clubFundTransactionsRepository } from "./clubFundTransactions.repository.js";
import { debtsRepository } from "../debts/debts.repository.js";
import { periodsRepository } from "../periods/periods.repository.js";
import { validateAmount, validateText, assertValid } from "../../utils/validators.js";
import { assertPeopleActive } from "../../utils/peopleGuard.js";

const allowedTypes = ["income", "expense", "refund", "adjustment"];

const CARRY_OUT_TAG = "Ket chuyen quy sang ky sau";

// Số dư quỹ của 1 kỳ = thu + điều chỉnh − chi − hoàn (khớp công thức dashboard)
function computeFundBalance(transactions = []) {
  return transactions.reduce((sum, t) => {
    const amt = Number(t.amount) || 0;
    if (t.transaction_type === "income" || t.transaction_type === "adjustment") return sum + amt;
    if (t.transaction_type === "expense" || t.transaction_type === "refund") return sum - amt;
    return sum;
  }, 0);
}

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

  // Kết chuyển số dư tiền mặt của 1 kỳ sang kỳ sau:
  //   - Ghi CHI ở kỳ nguồn "Kết chuyển sang kỳ sau" -> quỹ kỳ nguồn về 0
  //   - Ghi THU ở kỳ đích "Số dư mang sang" -> quỹ kỳ đích bắt đầu bằng số đó
  // Nợ chưa trả KHÔNG đụng tới (đi theo người, đòi tiếp).
  async carryOver(payload = {}) {
    const { from_period_id, to_period_id } = payload;
    if (!from_period_id) throw new Error("Chua chon ky nguon");
    if (!to_period_id) throw new Error("Chua chon ky dich");
    if (from_period_id === to_period_id) throw new Error("Ky nguon va ky dich phai khac nhau");

    const txResult = await clubFundTransactionsRepository.getByPeriod(from_period_id);
    if (txResult.error) throw new Error(txResult.error.message);
    const transactions = txResult.data || [];

    // Idempotency: đã kết chuyển kỳ nguồn rồi thì thôi
    if (transactions.some((t) => t.transaction_type === "expense" && (t.description || "").includes(CARRY_OUT_TAG))) {
      throw new Error("Ky nay da ket chuyen quy sang ky sau roi");
    }

    const balance = computeFundBalance(transactions);
    if (balance <= 0) {
      throw new Error("Quy ky nay khong con so du duong de ket chuyen");
    }

    const fromResult = await periodsRepository.getById(from_period_id);
    if (fromResult.error) throw new Error(fromResult.error.message);
    const toResult = await periodsRepository.getById(to_period_id);
    if (toResult.error) throw new Error(toResult.error.message);
    const fromName = fromResult.data?.name || "ky truoc";
    const toName = toResult.data?.name || "ky sau";

    // 1) CHI ở kỳ nguồn
    const outResult = await clubFundTransactionsRepository.create({
      period_id: from_period_id,
      person_id: null,
      payment_id: null,
      transaction_type: "expense",
      amount: balance,
      description: `${CARRY_OUT_TAG} "${toName}"`
    });
    if (outResult.error) throw new Error(outResult.error.message);

    // 2) THU ở kỳ đích
    const inResult = await clubFundTransactionsRepository.create({
      period_id: to_period_id,
      person_id: null,
      payment_id: null,
      transaction_type: "income",
      amount: balance,
      description: `So du mang sang tu ky "${fromName}"`
    });
    if (inResult.error) throw new Error(inResult.error.message);

    return {
      message: `Da ket chuyen ${balance} tu "${fromName}" sang "${toName}"`,
      amount: balance,
      out_transaction: outResult.data,
      in_transaction: inResult.data
    };
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
