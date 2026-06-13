import { peopleRepository } from "./people.repository.js";

const allowedStatuses = ["active", "inactive"];

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

  async createPerson(payload) {
    if (!payload.full_name) {
      throw new Error("Full name is required");
    }

    const status = payload.status || "active";

    if (!allowedStatuses.includes(status)) {
      throw new Error("Status khong hop le. Chi duoc dung: active, inactive");
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
