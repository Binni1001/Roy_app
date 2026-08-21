import { peopleRepository } from "./people.repository.js";
import { groupsService } from "../groups/groups.service.js";
import {
  validateFullName,
  validateNickname,
  validatePhone,
  validateEmail,
  validateDate,
  validateText,
  assertValid
} from "../../utils/validators.js";

const allowedStatuses = ["active", "inactive", "pending"];
const allowedAttendanceTypes = ["fixed", "guest"];
const allowedGenders = ["male", "female", "other"];

export const peopleService = {
  async getAllPeople(user, authRole) {
    const manager = await this.getPersonByAuthUser(user);
    if (!manager) {
      throw Object.assign(new Error("Không tìm thấy hồ sơ của tài khoản quản trị"), { statusCode: 403 });
    }

    const groupId = await groupsService.resolveManagedGroupId(manager, authRole);
    if (!groupId) {
      throw Object.assign(new Error("Tài khoản chưa có nhóm đang hoạt động"), { statusCode: 403 });
    }

    const { data, error } = await peopleRepository.getAll();

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).filter((person) =>
      person.group_id === groupId ||
      person.active_group_id === groupId ||
      (person.person_groups || []).some((membership) => membership.group_id === groupId)
    );
  },

  async getPersonById(id) {
    const { data, error } = await peopleRepository.getById(id);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async getPersonByAuthUser(user) {
    const email = user?.email;

    if (!email) {
      throw new Error("Auth user email is required");
    }

    const { data, error } = await peopleRepository.getByEmail(email);

    if (error) {
      throw new Error(error.message);
    }

    if (!data) return null;

    const membershipResult = await peopleRepository.getGroupMemberships(data.id);
    if (membershipResult.error) {
      throw new Error(membershipResult.error.message);
    }

    const memberships = membershipResult.data || [];
    const membership =
      memberships.find((item) => item.group_id === data.active_group_id) ||
      memberships.find((item) => item.status === "pending") ||
      memberships.find((item) => item.status === "active") ||
      null;

    return {
      ...data,
      membership_status: membership?.status || null,
      membership_group_id: membership?.group_id || null,
      member_role: membership?.member_role || null
    };
  },

  async createPersonForAuthUser(user, payload) {
    const email = user?.email;

    if (!email) {
      throw new Error("Auth user email is required");
    }

    const existing = await this.getPersonByAuthUser(user);
    if (existing) return existing;

    return await this.createPerson({
      ...payload,
      email
    });
  },

  async updatePersonForAuthUser(user, payload = {}) {
    const person = await this.getPersonByAuthUser(user);

    if (!person) {
      throw new Error("Player profile does not exist");
    }

    const allowedPayload = {};

    if (payload.full_name !== undefined) allowedPayload.full_name = payload.full_name;
    if (payload.nickname !== undefined) allowedPayload.nickname = payload.nickname;
    if (payload.phone !== undefined) allowedPayload.phone = payload.phone;
    if (payload.attendance_type !== undefined) allowedPayload.attendance_type = payload.attendance_type;
    if (payload.bio !== undefined) allowedPayload.bio = payload.bio;
    if (payload.birthday !== undefined) allowedPayload.birthday = payload.birthday;
    if (payload.gender !== undefined) allowedPayload.gender = payload.gender;
    if (payload.avatar_url !== undefined) allowedPayload.avatar_url = payload.avatar_url;

    return await this.updatePerson(person.id, allowedPayload);
  },

  async createPerson(payload) {
    // Validate bắt buộc
    assertValid(validateFullName(payload.full_name));

    // Validate optional fields
    assertValid(validateNickname(payload.nickname));
    assertValid(validatePhone(payload.phone));
    assertValid(validateEmail(payload.email));
    assertValid(validateDate(payload.birthday, "Ngay sinh"));
    assertValid(validateDate(payload.joined_at, "Ngay tham gia"));
    assertValid(validateText(payload.bio, "Bio", 500));
    assertValid(validateText(payload.note, "Ghi chu", 500));

    const status = payload.status || "active";
    const attendanceType = payload.attendance_type || "guest";

    if (!allowedStatuses.includes(status)) {
      throw new Error("Status khong hop le. Chi duoc dung: active, inactive, pending");
    }

    if (!allowedAttendanceTypes.includes(attendanceType)) {
      throw new Error("Attendance type khong hop le. Chi duoc dung: fixed, guest");
    }

    if (payload.gender !== undefined && payload.gender !== null && payload.gender !== "") {
      if (!allowedGenders.includes(payload.gender)) {
        throw new Error("Gender khong hop le. Chi duoc dung: male, female, other");
      }
    }

    const { data, error } = await peopleRepository.create({
      full_name: payload.full_name.trim(),
      nickname: payload.nickname?.trim() || null,
      phone: payload.phone?.replace(/\s|-/g, "") || null,
      email: payload.email?.trim().toLowerCase() || null,
      avatar_url: payload.avatar_url || null,
      bio: payload.bio || null,
      birthday: payload.birthday || null,
      gender: payload.gender || null,
      status,
      attendance_type: attendanceType,
      joined_at: payload.joined_at || null,
      last_play_date: payload.last_play_date || null,
      note: payload.note || null,
      group_id: payload.group_id || null,
      active_group_id: payload.active_group_id || payload.group_id || null
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async createManagedPerson(user, authRole, payload) {
    const manager = await this.getPersonByAuthUser(user);
    if (!manager) {
      throw Object.assign(new Error("Không tìm thấy hồ sơ của tài khoản quản trị"), { statusCode: 403 });
    }

    const groupId = await groupsService.resolveManagedGroupId(manager, authRole);
    if (!groupId) {
      throw Object.assign(new Error("Tài khoản chưa có nhóm đang hoạt động"), { statusCode: 403 });
    }

    const status = payload.status || "active";
    const person = await this.createPerson({
      ...payload,
      status,
      group_id: groupId,
      active_group_id: status === "active" ? groupId : null
    });

    try {
      const membership = await groupsService.addManagedMember(person.id, groupId, status);
      return {
        ...person,
        person_groups: [{
          group_id: membership.group_id,
          status: membership.status,
          member_role: membership.member_role
        }]
      };
    } catch (error) {
      await peopleRepository.remove(person.id);
      throw error;
    }
  },

  async updatePerson(id, payload = {}) {
    if (!id) {
      throw new Error("Person ID khong duoc de trong");
    }

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (payload.full_name !== undefined) {
      assertValid(validateFullName(payload.full_name));
      updateData.full_name = payload.full_name.trim();
    }

    if (payload.nickname !== undefined) {
      assertValid(validateNickname(payload.nickname));
      updateData.nickname = payload.nickname?.trim() || null;
    }

    if (payload.phone !== undefined) {
      assertValid(validatePhone(payload.phone));
      updateData.phone = payload.phone ? payload.phone.replace(/\s|-/g, "") : null;
    }

    if (payload.email !== undefined) {
      if (payload.email) {
        assertValid(validateEmail(payload.email));
        updateData.email = payload.email.trim().toLowerCase();
      } else {
        updateData.email = null;
      }
    }

    if (payload.avatar_url !== undefined) updateData.avatar_url = payload.avatar_url;

    if (payload.bio !== undefined) {
      assertValid(validateText(payload.bio, "Bio", 500));
      updateData.bio = payload.bio;
    }

    if (payload.birthday !== undefined) {
      assertValid(validateDate(payload.birthday, "Ngay sinh"));
      updateData.birthday = payload.birthday;
    }

    if (payload.gender !== undefined) {
      if (payload.gender && !allowedGenders.includes(payload.gender)) {
        throw new Error("Gender khong hop le. Chi duoc dung: male, female, other");
      }
      updateData.gender = payload.gender || null;
    }

    if (payload.joined_at !== undefined) {
      assertValid(validateDate(payload.joined_at, "Ngay tham gia"));
      updateData.joined_at = payload.joined_at;
    }

    if (payload.last_play_date !== undefined) {
      updateData.last_play_date = payload.last_play_date;
    }

    if (payload.note !== undefined) {
      assertValid(validateText(payload.note, "Ghi chu", 500));
      updateData.note = payload.note;
    }

    if (payload.status !== undefined) {
      if (!allowedStatuses.includes(payload.status)) {
        throw new Error("Status khong hop le. Chi duoc dung: active, inactive, pending");
      }
      updateData.status = payload.status;
    }

    if (payload.group_id !== undefined) {
      updateData.group_id = payload.group_id;
    }

    if (payload.attendance_type !== undefined) {
      if (!allowedAttendanceTypes.includes(payload.attendance_type)) {
        throw new Error("Attendance type khong hop le. Chi duoc dung: fixed, guest");
      }
      updateData.attendance_type = payload.attendance_type;
    }

    const { data, error } = await peopleRepository.update(id, updateData);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async updatePersonPassword(id, newPassword) {
    if (!id) throw new Error("Person ID không được để trống");
    if (!newPassword || newPassword.length < 6) throw new Error("Mật khẩu phải có ít nhất 6 ký tự");

    const person = await this.getPersonById(id);
    if (!person?.email) throw new Error("Người dùng này chưa có email liên kết");

    const { supabase } = await import("../../config/supabase.js");
    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw new Error(listErr.message);

    const authUser = users.find((u) => u.email?.toLowerCase() === person.email.toLowerCase());
    if (!authUser) throw new Error("Không tìm thấy tài khoản Supabase Auth cho email này");

    const { error: updateErr } = await supabase.auth.admin.updateUserById(authUser.id, { password: newPassword });
    if (updateErr) throw new Error(updateErr.message);

    return { success: true };
  },

  async deletePerson(id) {
    if (!id) {
      throw new Error("Person ID khong duoc de trong");
    }

    const { data, error } = await peopleRepository.remove(id);

    if (error) {
      if (error.code === "23503") {
        throw new Error(
          "Không thể xóa người này vì đã có dữ liệu liên quan (kỳ sinh hoạt, công nợ, kèo PK, chi phí cầu...). Hãy chuyển trạng thái sang \"Nghỉ\" thay vì xóa."
        );
      }
      throw new Error(error.message);
    }

    return data;
  }
};
