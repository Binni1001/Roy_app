import express from "express";
import { paymentsController } from "./payments.controller.js";

const router = express.Router();

router.post(
  "/create-for-person-period",
  paymentsController.createForPersonPeriod
);

export default router;