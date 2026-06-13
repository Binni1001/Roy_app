import { periodsRepository } from "./periods.repository.js";

export const periodsService = {
  async getAllPeriods() {
    const { data, error } = await periodsRepository.getAll();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async getPeriodById(id) {
    const { data, error } = await periodsRepository.getById(id);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async createPeriod(payload) {
    if (!payload.name) {
      throw new Error("Ten ky khong duoc de trong");
    }

    if (!payload.start_date) {
      throw new Error("Ngay bat dau khong duoc de trong");
    }

    if (!payload.end_date) {
      throw new Error("Ngay ket thuc khong duoc de trong");
    }

    if (new Date(payload.end_date) < new Date(payload.start_date)) {
      throw new Error("Ngay ket thuc khong duoc nho hon ngay bat dau");
    }

    if (Number(payload.fixed_member_fee) < 0) {
      throw new Error("Tien co dinh khong duoc nho hon 0");
    }

    if (Number(payload.guest_fee_per_session) < 0) {
      throw new Error("Tien khach vang lai khong duoc nho hon 0");
    }

    const { data, error } = await periodsRepository.create({
      name: payload.name,
      start_date: payload.start_date,
      end_date: payload.end_date,
      fixed_member_fee: Number(payload.fixed_member_fee || 0),
      guest_fee_per_session: Number(payload.guest_fee_per_session || 0),
      status: payload.status || "draft",
      note: payload.note || null
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async updatePeriod(id, payload) {
    if (payload.start_date && payload.end_date) {
      if (new Date(payload.end_date) < new Date(payload.start_date)) {
        throw new Error("Ngay ket thuc khong duoc nho hon ngay bat dau");
      }
    }

    const updateData = {
      ...payload,
      updated_at: new Date().toISOString()
    };

    if (payload.fixed_member_fee !== undefined) {
      updateData.fixed_member_fee = Number(payload.fixed_member_fee);
    }

    if (payload.guest_fee_per_session !== undefined) {
      updateData.guest_fee_per_session = Number(payload.guest_fee_per_session);
    }

    const { data, error } = await periodsRepository.update(id, updateData);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }
};