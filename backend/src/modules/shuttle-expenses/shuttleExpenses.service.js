import { shuttleExpensesRepository } from "./shuttleExpenses.repository.js";

const allowedBuyTypes = ["tube", "single", "mixed"];

export const shuttleExpensesService = {
  async getAll() {
    const { data, error } = await shuttleExpensesRepository.getAll();
    if (error) throw new Error(error.message);
    return data;
  },

  async getByPeriod(periodId) {
    if (!periodId) throw new Error("Period ID không được để trống");

    const { data, error } = await shuttleExpensesRepository.getByPeriodId(periodId);
    if (error) throw new Error(error.message);
    return data;
  },

  async create(payload = {}) {
    if (!payload.period_id) throw new Error("Period ID không được để trống");
    if (!payload.buyer_id) throw new Error("Buyer ID không được để trống");

    const buyType = payload.buy_type || "tube";

    if (!allowedBuyTypes.includes(buyType)) {
      throw new Error("Loại mua cầu không hợp lệ");
    }

    const tubeCount = Number(payload.tube_count || 0);
    const shuttlePerTube = Number(payload.shuttle_per_tube || 12);
    const singleCount = Number(payload.single_count || 0);
    const totalAmount = Number(payload.total_amount || 0);

    if (tubeCount < 0) throw new Error("Số ống không được nhỏ hơn 0");
    if (shuttlePerTube <= 0) throw new Error("Số quả mỗi ống phải lớn hơn 0");
    if (singleCount < 0) throw new Error("Số quả lẻ không được nhỏ hơn 0");
    if (totalAmount <= 0) throw new Error("Tổng tiền mua cầu phải lớn hơn 0");

    if (buyType === "tube" && tubeCount <= 0) {
      throw new Error("Mua theo ống thì số ống phải lớn hơn 0");
    }

    if (buyType === "single" && singleCount <= 0) {
      throw new Error("Mua lẻ thì số quả lẻ phải lớn hơn 0");
    }

    if (buyType === "mixed" && tubeCount <= 0 && singleCount <= 0) {
      throw new Error("Mua mixed thì phải có số ống hoặc số quả lẻ");
    }

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
    if (!id) throw new Error("Shuttle expense ID không được để trống");

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (payload.buy_type !== undefined) {
      if (!allowedBuyTypes.includes(payload.buy_type)) {
        throw new Error("Loại mua cầu không hợp lệ");
      }
      updateData.buy_type = payload.buy_type;
    }

    if (payload.tube_count !== undefined) {
      if (Number(payload.tube_count) < 0) throw new Error("Số ống không được nhỏ hơn 0");
      updateData.tube_count = Number(payload.tube_count);
    }

    if (payload.shuttle_per_tube !== undefined) {
      if (Number(payload.shuttle_per_tube) <= 0) throw new Error("Số quả mỗi ống phải lớn hơn 0");
      updateData.shuttle_per_tube = Number(payload.shuttle_per_tube);
    }

    if (payload.single_count !== undefined) {
      if (Number(payload.single_count) < 0) throw new Error("Số quả lẻ không được nhỏ hơn 0");
      updateData.single_count = Number(payload.single_count);
    }

    if (payload.total_amount !== undefined) {
      if (Number(payload.total_amount) <= 0) throw new Error("Tổng tiền mua cầu phải lớn hơn 0");
      updateData.total_amount = Number(payload.total_amount);
    }

    if (payload.buy_date !== undefined) {
      updateData.buy_date = payload.buy_date;
    }

    if (payload.note !== undefined) {
      updateData.note = payload.note;
    }

    const { data, error } = await shuttleExpensesRepository.update(id, updateData);

    if (error) throw new Error(error.message);
    return data;
  },

  async remove(id) {
    if (!id) throw new Error("Shuttle expense ID không được để trống");

    const { data, error } = await shuttleExpensesRepository.remove(id);
    if (error) throw new Error(error.message);
    return data;
  }
};