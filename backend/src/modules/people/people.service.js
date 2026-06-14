import { peopleRepository } from "./people.repository.js";
import {
  validateFullName,
  validateNickname,
  validatePhone,
  validateEmail,
  validateDate,
  validateText,
  assertValid
} from "../../utils/validators.js";

const allowedStatuses = ["active", "inactive"];
const allowedAttendanceTypes = ["fixed", "guest"];
const allowedGenders = ["male", "female", "other"];

export const peopleService = {
  async getAllPeople() {
    const { data, error } = await peopleRepository.getAll();

    if (error) {
      throw new Error(error.message);
    }

    return data;
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

    return data;
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
    if (payload.phone !== undefined) allowedPayload.phone = payload.phone;
    if (payload.attendance_type !== undefined) {
      allowedPayload.attendance_type = payload.attendance_type;
    }

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
      throw new Error("Status khong hop le. Chi duoc dung: active, inactive");
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
      note: payload.note || null
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
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
        throw new Error("Status khong hop le. Chi duoc dung: active, inactive");
      }
      updateData.status = payload.status;
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

  async deletePerson(id) {
    if (!id) {
      throw new Error("Person ID khong duoc de trong");
    }

    const { data, error } = await peopleRepository.remove(id);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }
};
