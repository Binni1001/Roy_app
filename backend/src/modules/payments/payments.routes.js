import express from "express";
import { requireAuth } from "../../middleware/auth.js";
import { paymentsController } from "./payments.controller.js";

const router = express.Router();

router.post(
  "/create-for-person-period",
  requireAuth,
  paymentsController.createForPersonPeriod
);

router.post("/payos-webhook", paymentsController.payosWebhook);
router.put("/:id/cancel", requireAuth, paymentsController.cancelPayment);

export default router;
