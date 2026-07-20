import { periodsRepository } from "./periods.repository.js";
import { validateText, validateAmount, requireDate, assertValid } from "../../utils/validators.js";

const allowedStatuses = ["draft", "open", "closed"];

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

  async createPeriod(payload, authUser) {
    if (!payload.name || !payload.name.trim()) {
      throw new Error("Ten ky khong duoc de trong");
    }

    if (payload.name.trim().length > 100) {
      throw new Error("Ten ky qua dai (toi da 100 ky tu)");
    }

    assertValid(requireDate(payload.start_date, "Ngay bat dau"));
    assertValid(requireDate(payload.end_date, "Ngay ket thuc"));

    if (new Date(payload.end_date) < new Date(payload.start_date)) {
      throw new Error("Ngay ket thuc khong duoc nho hon ngay bat dau");
    }

    // Validate phí (cho phép 0 nhưng không âm)
    assertValid(validateAmount(payload.fixed_member_fee ?? 0, "Tien co dinh", true));
    assertValid(validateAmount(payload.guest_fee_per_session ?? 0, "Tien khach vang lai", true));

    assertValid(validateText(payload.note, "Ghi chu", 500));

    const status = payload.status || "draft";
    if (!allowedStatuses.includes(status)) {
      throw new Error(`Trang thai ky khong hop le. Chi duoc dung: ${allowedStatuses.join(", ")}`);
    }

    const groupResult = await periodsRepository.getActiveGroupByEmail(authUser?.email || "");
    if (groupResult.error) throw new Error(groupResult.error.message);

    const groupId = groupResult.data?.active_group_id || groupResult.data?.group_id || null;
    if (!groupId) throw new Error("Tai khoan chua co nhom dang hoat dong");

    const { data, error } = await periodsRepository.create({
      name: payload.name.trim(),
      start_date: payload.start_date,
      end_date: payload.end_date,
      fixed_member_fee: Number(payload.fixed_member_fee || 0),
      guest_fee_per_session: Number(payload.guest_fee_per_session || 0),
      status,
      note: payload.note || null,
      group_id: groupId
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async updatePeriod(id, payload) {
    if (!id) throw new Error("Period ID khong duoc de trong");

    // Validate tên nếu có cập nhật
    if (payload.name !== undefined) {
      if (!payload.name || !payload.name.trim()) {
        throw new Error("Ten ky khong duoc de trong");
      }
      if (payload.name.trim().length > 100) {
        throw new Error("Ten ky qua dai (toi da 100 ky tu)");
      }
    }

    // Validate ngày nếu cả hai đều truyền vào
    if (payload.start_date !== undefined) {
      assertValid(requireDate(payload.start_date, "Ngay bat dau"));
    }

    if (payload.end_date !== undefined) {
      assertValid(requireDate(payload.end_date, "Ngay ket thuc"));
    }

    if (payload.start_date && payload.end_date) {
      if (new Date(payload.end_date) < new Date(payload.start_date)) {
        throw new Error("Ngay ket thuc khong duoc nho hon ngay bat dau");
      }
    }

    // FIX: validate fee không âm khi update
    if (payload.fixed_member_fee !== undefined) {
      assertValid(validateAmount(payload.fixed_member_fee, "Tien co dinh", true));
    }

    if (payload.guest_fee_per_session !== undefined) {
      assertValid(validateAmount(payload.guest_fee_per_session, "Tien khach vang lai", true));
    }

    if (payload.status !== undefined && !allowedStatuses.includes(payload.status)) {
      throw new Error(`Trang thai ky khong hop le. Chi duoc dung: ${allowedStatuses.join(", ")}`);
    }

    assertValid(validateText(payload.note, "Ghi chu", 500));

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (payload.name !== undefined) updateData.name = payload.name.trim();
    if (payload.start_date !== undefined) updateData.start_date = payload.start_date;
    if (payload.end_date !== undefined) updateData.end_date = payload.end_date;
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.note !== undefined) updateData.note = payload.note;

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
