import { shuttleExpensesRepository } from "./shuttleExpenses.repository.js";
import { clubFundTransactionsRepository } from "../club-fund-transactions/clubFundTransactions.repository.js";
import { validateDateNotFuture, validateAmount, validateText, assertValid } from "../../utils/validators.js";
import { assertPeopleActive } from "../../utils/peopleGuard.js";

const allowedBuyTypes = ["tube", "single", "mixed"];

function validateBuyTypeAndCounts(buyType, tubeCount, shuttlePerTube, singleCount) {
  if (!allowedBuyTypes.includes(buyType)) {
    throw new Error("Loai mua cau khong hop le");
  }

  if (tubeCount < 0) throw new Error("So ong khong duoc nho hon 0");
  if (shuttlePerTube <= 0) throw new Error("So qua moi ong phai lon hon 0");
  if (singleCount < 0) throw new Error("So qua le khong duoc nho hon 0");

  if (buyType === "tube" && tubeCount <= 0) {
    throw new Error("Mua theo ong thi so ong phai lon hon 0");
  }

  if (buyType === "single" && singleCount <= 0) {
    throw new Error("Mua le thi so qua le phai lon hon 0");
  }

  if (buyType === "mixed" && tubeCount <= 0 && singleCount <= 0) {
    throw new Error("Mua mixed thi phai co so ong hoac so qua le");
  }
}

export const shuttleExpensesService = {
  async getAll() {
    const { data, error } = await shuttleExpensesRepository.getAll();
    if (error) throw new Error(error.message);
    return data;
  },

  async getByPeriod(periodId) {
    if (!periodId) throw new Error("Period ID khong duoc de trong");

    const { data, error } = await shuttleExpensesRepository.getByPeriodId(periodId);
    if (error) throw new Error(error.message);
    return data;
  },

  async create(payload = {}) {
    if (!payload.period_id) throw new Error("Period ID khong duoc de trong");
    if (!payload.buyer_id) throw new Error("Buyer ID khong duoc de trong");

    // FIX #5: check period status
    const { data: period, error: periodError } = await shuttleExpensesRepository.getPeriodById(payload.period_id);
    if (periodError) throw new Error(periodError.message);
    if (period.status === "closed") {
      throw new Error("Ky nay da dong, khong the them chi phi cau");
    }
    if (period.status === "draft") {
      throw new Error("Ky nay chua mo, khong the them chi phi cau");
    }

    // FIX #6: check buyer phải là fixed member của kỳ này
    const { data: membership, error: memberError } = await shuttleExpensesRepository.getFixedMember(
      payload.period_id,
      payload.buyer_id
    );
    if (memberError) throw new Error(memberError.message);
    if (!membership) {
      throw new Error("Nguoi mua cau phai la fixed member cua ky nay");
    }

    await assertPeopleActive([payload.buyer_id]);

    const buyType = payload.buy_type || "tube";
    const tubeCount = Number(payload.tube_count || 0);
    const shuttlePerTube = Number(payload.shuttle_per_tube || 12);
    const singleCount = Number(payload.single_count || 0);
    const totalAmount = Number(payload.total_amount || 0);

    validateBuyTypeAndCounts(buyType, tubeCount, shuttlePerTube, singleCount);
    // Cho phép 0: khi quỹ trả hết, phần thành viên tự bỏ = 0
    assertValid(validateAmount(totalAmount, "Tong tien mua cau", true));

    // Validate buy_date: không được ở tương lai
    assertValid(validateDateNotFuture(payload.buy_date, "Ngay mua cau"));

    const { data, error } = await shuttleExpensesRepository.create({
      period_id: payload.period_id,
      buyer_id: payload.buyer_id,
      buy_type: buyType,
      tube_count: tubeCount,
      shuttle_per_tube: shuttlePerTube,
      single_count: singleCount,
      total_amount: totalAmount,
      buy_date: payload.buy_date || new Date().toISOString().slice(0, 10),
      note: payload.note || null
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, payload = {}) {
    if (!id) throw new Error("Shuttle expense ID khong duoc de trong");

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (payload.buy_type !== undefined) {
      if (!allowedBuyTypes.includes(payload.buy_type)) {
        throw new Error("Loai mua cau khong hop le");
      }
      updateData.buy_type = payload.buy_type;
    }

    if (payload.tube_count !== undefined) {
      if (Number(payload.tube_count) < 0) throw new Error("So ong khong duoc nho hon 0");
      updateData.tube_count = Number(payload.tube_count);
    }

    if (payload.shuttle_per_tube !== undefined) {
      if (Number(payload.shuttle_per_tube) <= 0) throw new Error("So qua moi ong phai lon hon 0");
      updateData.shuttle_per_tube = Number(payload.shuttle_per_tube);
    }

    if (payload.single_count !== undefined) {
      if (Number(payload.single_count) < 0) throw new Error("So qua le khong duoc nho hon 0");
      updateData.single_count = Number(payload.single_count);
    }

    if (payload.total_amount !== undefined) {
      if (Number(payload.total_amount) < 0) throw new Error("Tong tien mua cau khong duoc am");
      updateData.total_amount = Number(payload.total_amount);
    }

    if (payload.buy_date !== undefined) {
      updateData.buy_date = payload.buy_date;
    }

    if (payload.note !== undefined) {
      assertValid(validateText(payload.note, "Ghi chu", 500));
      updateData.note = payload.note;
    }

    const { data, error } = await shuttleExpensesRepository.update(id, updateData);

    if (error) throw new Error(error.message);
    return data;
  },

  async remove(id) {
    if (!id) throw new Error("Shuttle expense ID khong duoc de trong");

    const { data, error } = await shuttleExpensesRepository.remove(id);
    if (error) throw new Error(error.message);
    return data;
  },

  // Mua cau khi quy khong du tien: tach 1 lan mua thanh 2 nguon -
  // phan quy chi (ghi vao so quy) va phan thanh vien tu bo tien (duoc
  // chia/hoan lai qua chot tien cau).
  async createWithFundSplit(payload = {}) {
    if (!payload.period_id) throw new Error("Period ID khong duoc de trong");
    if (!payload.buyer_id) throw new Error("Vui long chon nguoi mua/dai dien mua cau");

    const { data: period, error: periodError } = await shuttleExpensesRepository.getPeriodById(payload.period_id);
    if (periodError) throw new Error(periodError.message);
    if (!period) throw new Error("Period khong ton tai");
    if (period.status === "closed") {
      throw new Error("Ky nay da dong, khong the them chi phi cau");
    }
    if (period.status === "draft") {
      throw new Error("Ky nay chua mo, khong the them chi phi cau");
    }

    const { data: membership, error: memberError } = await shuttleExpensesRepository.getFixedMember(
      payload.period_id,
      payload.buyer_id
    );
    if (memberError) throw new Error(memberError.message);
    if (!membership) {
      throw new Error("Nguoi mua cau phai la fixed member cua ky nay");
    }

    await assertPeopleActive([payload.buyer_id]);

    const buyType = payload.buy_type || "tube";
    const tubeCount = Number(payload.tube_count || 0);
    const shuttlePerTube = Number(payload.shuttle_per_tube || 12);
    const singleCount = Number(payload.single_count || 0);

    validateBuyTypeAndCounts(buyType, tubeCount, shuttlePerTube, singleCount);
    assertValid(validateDateNotFuture(payload.buy_date, "Ngay mua cau"));
    assertValid(validateText(payload.note, "Ghi chu", 500));

    const totalPrice = Number(payload.total_price);
    assertValid(validateAmount(totalPrice, "Tong gia mua cau"));

    const fundAmount = Number(payload.fund_amount || 0);
    assertValid(validateAmount(fundAmount, "So tien quy chi", true));

    if (fundAmount > totalPrice) {
      throw new Error("So tien quy chi khong duoc lon hon tong gia mua cau");
    }

    const personalAmount = Math.round((totalPrice - fundAmount) * 100) / 100;

    if (personalAmount <= 0 && fundAmount <= 0) {
      throw new Error("Phai co it nhat mot nguon chi tien (quy hoac ca nhan) lon hon 0");
    }

    const buyDate = payload.buy_date || new Date().toISOString().slice(0, 10);
    const note = payload.note || null;

    const { data: shuttleExpense, error: shuttleError } = await shuttleExpensesRepository.create({
      period_id: payload.period_id,
      buyer_id: payload.buyer_id,
      buy_type: buyType,
      tube_count: tubeCount,
      shuttle_per_tube: shuttlePerTube,
      single_count: singleCount,
      total_amount: personalAmount,
      buy_date: buyDate,
      note
    });

    if (shuttleError) throw new Error(shuttleError.message);

    let fundTransaction = null;

    if (fundAmount > 0) {
      const { data, error } = await clubFundTransactionsRepository.create({
        period_id: payload.period_id,
        person_id: payload.buyer_id,
        payment_id: null,
        transaction_type: "expense",
        amount: fundAmount,
        description: note ? `Mua cau (quy chi) - ${note}` : "Mua cau (quy chi)"
      });

      if (error) throw new Error(error.message);
      fundTransaction = data;
    }

    return { shuttle_expense: shuttleExpense, fund_transaction: fundTransaction };
  }
};