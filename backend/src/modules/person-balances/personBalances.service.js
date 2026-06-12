import { personBalancesRepository } from "./personBalances.repository.js";

export const personBalancesService = {
  async getAllBalances() {
    const { data, error } =
      await personBalancesRepository.getAllBalances();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async getBalanceByPerson(personId) {
    if (!personId) {
      throw new Error("Person ID không được để trống");
    }

    const { data, error } =
      await personBalancesRepository.getBalanceByPerson(personId);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async getTransactions(personId) {
    if (!personId) {
      throw new Error("Person ID không được để trống");
    }

    const { data, error } =
      await personBalancesRepository.getTransactions(personId);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }
};