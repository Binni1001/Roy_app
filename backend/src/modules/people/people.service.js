import { peopleRepository } from "./people.repository.js";

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

    const { data, error } = await peopleRepository.create({
      full_name: payload.full_name,
      nickname: payload.nickname || null,
      phone: payload.phone || null,
      email: payload.email || null,
      avatar_url: payload.avatar_url || null,
      bio: payload.bio || null,
      note: payload.note || null
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }
};