import express from "express";
import { paymentsController } from "./payments.controller.js";

const router = express.Router();

router.post(
  "/create-for-person-period",
  paymentsController.createForPersonPeriod
);

router.post("/payos-webhook", paymentsController.payosWebhook);

export default router;