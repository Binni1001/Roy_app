import { badmintonSessionsRepository } from "./badmintonSessions.repository.js";
import { periodsService } from "../periods/periods.service.js";
import { groupAccess } from "../../services/groupAccess.js";
import { validateDateNotFuture, validateText, assertValid } from "../../utils/validators.js";

export const badmintonSessionsService = {
  async getAll(authUser) {
    const groups = await groupAccess.visibleGroupIds(authUser);
    const { data, error } = await badmintonSessionsRepository.getAll(groups);
    if (error) throw new Error(error.message);
    return data;
  },

  async getByPeriod(periodId, authUser) {
    if (!periodId) throw new Error("Period ID khong duoc de trong");
    await periodsService.getAccessiblePeriod(periodId, authUser);

    const { data, error } =
      await badmintonSessionsRepository.getByPeriodId(periodId);

    if (error) throw new Error(error.message);
    return data;
  },

  async getById(id, authUser, write = false) {
    if (!id) throw new Error("Session ID khong duoc de trong");

    const { data, error } = await badmintonSessionsRepository.getById(id);
    if (error) throw new Error(error.message);
    await periodsService.getAccessiblePeriod(data.period_id, authUser, write);
    return data;
  },

  async create(payload = {}, authUser) {
    if (!payload.period_id) throw new Error("Period ID khong duoc de trong");
    if (!payload.play_date) throw new Error("Ngay danh khong duoc de trong");

    // FIX #5: check period status trước khi tạo buổi tập
    const period = await periodsService.getAccessiblePeriod(payload.period_id, authUser, true);
    if (period.status === "closed") {
      throw new Error("Ky nay da dong, khong the them buoi tap moi");
    }
    if (period.status === "draft") {
      throw new Error("Ky nay chua mo, khong the them buoi tap");
    }

    // Ngày đánh không được ở tương lai
    assertValid(validateDateNotFuture(payload.play_date, "Ngay danh"));
    assertValid(validateText(payload.note, "Ghi chu", 500));

    const shuttleUsedCount = Number(payload.shuttle_used_count ?? 0);

    if (!Number.isSafeInteger(shuttleUsedCount) || shuttleUsedCount < 0) {
      throw new Error("So cau da dung phai la so nguyen khong am hop le");
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

  async update(id, payload = {}, authUser) {
    if (!id) throw new Error("Session ID khong duoc de trong");
    const current = await this.getById(id, authUser, true);
    const period = await periodsService.getAccessiblePeriod(current.period_id, authUser, true);
    if (period.status !== "open") throw new Error("Chi duoc sua buoi danh trong ky dang mo");
    if (payload.period_id !== undefined && payload.period_id !== current.period_id) {
      throw new Error("Khong duoc chuyen buoi danh sang ky khac");
    }

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (payload.play_date !== undefined) {
      assertValid(validateDateNotFuture(payload.play_date, "Ngay danh"));
      updateData.play_date = payload.play_date;
    }

    if (payload.shuttle_used_count !== undefined) {
      if (!Number.isSafeInteger(Number(payload.shuttle_used_count)) || Number(payload.shuttle_used_count) < 0) {
        throw new Error("So cau da dung phai la so nguyen khong am hop le");
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

  async remove(id, authUser) {
    if (!id) throw new Error("Session ID khong duoc de trong");
    await this.getById(id, authUser, true);

    const { data, error } = await badmintonSessionsRepository.remove(id);
    if (error) throw new Error(error.message);
    return data;
  }
};
