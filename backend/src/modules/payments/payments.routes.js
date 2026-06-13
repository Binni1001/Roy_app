import express from "express";
import { requireAuth, requirePaymentOwnerOrAdmin, requireSelfPersonOrAdmin } from "../../middleware/auth.js";
import { paymentsController } from "./payments.controller.js";

const router = express.Router();

router.post(
  "/create-for-person-period",
  requireAuth,
  requireSelfPersonOrAdmin("body", "person_id"),
  paymentsController.createForPersonPeriod
);

router.post("/payos-webhook", paymentsController.payosWebhook);
router.put("/:id/cancel", requireAuth, requirePaymentOwnerOrAdmin, paymentsController.cancelPayment);

export default router;
