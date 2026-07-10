import { balanceOffsetsService } from "./balanceOffsets.service.js";

export const balanceOffsetsController = {
  async offsetAllForPeriod(req, res) {
    try {
      const data = await balanceOffsetsService.offsetAllForPeriod(req.params.periodId);
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async offsetPersonPeriod(req, res) {
    try {
      const data = await balanceOffsetsService.offsetPersonPeriod(
        req.params.personId,
        req.params.periodId
      );

      res.json(data);
    } catch (error) {
      res.status(400).json({
        message: error.message
      });
    }
  }
};