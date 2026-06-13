import { peopleRepository } from "./people.repository.js";

const allowedStatuses = ["active", "inactive"];
const allowedAttendanceTypes = ["fixed", "guest"];

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
    if (!payload.full_name) {
      throw new Error("Full name is required");
    }

    const status = payload.status || "active";
    const attendanceType = payload.attendance_type || "guest";

    if (!allowedStatuses.includes(status)) {
      throw new Error("Status khong hop le. Chi duoc dung: active, inactive");
    }

    if (!allowedAttendanceTypes.includes(attendanceType)) {
      throw new Error("Attendance type khong hop le. Chi duoc dung: fixed, guest");
    }

    const { data, error } = await peopleRepository.create({
      full_name: payload.full_name,
      nickname: payload.nickname || null,
      phone: payload.phone || null,
      email: payload.email || null,
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
      if (!payload.full_name) {
        throw new Error("Full name is required");
      }

      updateData.full_name = payload.full_name;
    }

    if (payload.nickname !== undefined) updateData.nickname = payload.nickname;
    if (payload.phone !== undefined) updateData.phone = payload.phone;
    if (payload.email !== undefined) updateData.email = payload.email;
    if (payload.avatar_url !== undefined) updateData.avatar_url = payload.avatar_url;
    if (payload.bio !== undefined) updateData.bio = payload.bio;
    if (payload.birthday !== undefined) updateData.birthday = payload.birthday;
    if (payload.gender !== undefined) updateData.gender = payload.gender;
    if (payload.joined_at !== undefined) updateData.joined_at = payload.joined_at;
    if (payload.last_play_date !== undefined) {
      updateData.last_play_date = payload.last_play_date;
    }
    if (payload.note !== undefined) updateData.note = payload.note;

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
