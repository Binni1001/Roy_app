import { personBalancesService } from "./personBalances.service.js";

export const personBalancesController = {
  async getAll(req, res) {
    try {
      const data =
        await personBalancesService.getAllBalances();

      res.json(data);
    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  },

  async getByPerson(req, res) {
    try {
      const data =
        await personBalancesService.getBalanceByPerson(
          req.params.personId
        );

      res.json(data);
    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  },

  async getTransactions(req, res) {
    try {
      const data =
        await personBalancesService.getTransactions(
          req.params.personId
        );

      res.json(data);
    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  }
};