import express from "express";
import { balanceOffsetsController } from "./balanceOffsets.controller.js";

const router = express.Router();

router.post(
  "/person/:personId/period/:periodId",
  balanceOffsetsController.offsetPersonPeriod
);

export default router;