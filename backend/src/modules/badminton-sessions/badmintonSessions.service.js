import { badmintonSessionsRepository } from "./badmintonSessions.repository.js";
import { validateDateNotFuture, validateText, assertValid } from "../../utils/validators.js";

export const badmintonSessionsService = {
  async getAll() {
    const { data, error } = await badmintonSessionsRepository.getAll();
    if (error) throw new Error(error.message);
    return data;
  },

  async getByPeriod(periodId) {
    if (!periodId) throw new Error("Period ID khong duoc de trong");

    const { data, error } =
      await badmintonSessionsRepository.getByPeriodId(periodId);

    if (error) throw new Error(error.message);
    return data;
  },

  async getById(id) {
    if (!id) throw new Error("Session ID khong duoc de trong");

    const { data, error } = await badmintonSessionsRepository.getById(id);
    if (error) throw new Error(error.message);
    return data;
  },

  async create(payload = {}) {
    if (!payload.period_id) throw new Error("Period ID khong duoc de trong");
    if (!payload.play_date) throw new Error("Ngay danh khong duoc de trong");

    // FIX #5: check period status trước khi tạo buổi tập
    const { data: period, error: periodError } = await badmintonSessionsRepository.getPeriodById(payload.period_id);
    if (periodError) throw new Error(periodError.message);
    if (period.status === "closed") {
      throw new Error("Ky nay da dong, khong the them buoi tap moi");
    }
    if (period.status === "draft") {
      throw new Error("Ky nay chua mo, khong the them buoi tap");
    }

    // Ngày đánh không được ở tương lai
    assertValid(validateDateNotFuture(payload.play_date, "Ngay danh"));
    assertValid(validateText(payload.note, "Ghi chu", 500));

    const shuttleUsedCount = Number(payload.shuttle_used_count || 0);

    if (shuttleUsedCount < 0) {
      throw new Error("So cau da dung khong duoc nho hon 0");
    }

    const { data, error } = await badmintonSessionsRepository.create({
      period_id: payload.period_id,
      play_date: payload.play_date,
      shuttle_used_count: shuttleUsedCount,
      note: payload.note || null
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, payload = {}) {
    if (!id) throw new Error("Session ID khong duoc de trong");

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (payload.play_date !== undefined) {
      assertValid(validateDateNotFuture(payload.play_date, "Ngay danh"));
      updateData.play_date = payload.play_date;
    }

    if (payload.shuttle_used_count !== undefined) {
      if (Number(payload.shuttle_used_count) < 0) {
        throw new Error("So cau da dung khong duoc nho hon 0");
      }

      updateData.shuttle_used_count = Number(payload.shuttle_used_count);
    }

    if (payload.note !== undefined) {
      assertValid(validateText(payload.note, "Ghi chu", 500));
      updateData.note = payload.note;
    }

    const { data, error } = await badmintonSessionsRepository.update(
      id,
      updateData
    );

    if (error) throw new Error(error.message);
    return data;
  },

  async remove(id) {
    if (!id) throw new Error("Session ID khong duoc de trong");

    const { data, error } = await badmintonSessionsRepository.remove(id);
    if (error) throw new Error(error.message);
    return data;
  }
};
