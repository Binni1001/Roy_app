import express from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { balanceOffsetsController } from "./balanceOffsets.controller.js";

const router = express.Router();

router.post(
  "/period/:periodId/all",
  requireAuth,
  requireAdmin,
  balanceOffsetsController.offsetAllForPeriod
);

router.post(
  "/person/:personId/period/:periodId",
  requireAuth,
  requireAdmin,
  balanceOffsetsController.offsetPersonPeriod
);

export default router;
