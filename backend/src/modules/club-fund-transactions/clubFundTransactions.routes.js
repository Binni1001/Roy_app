import express from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { clubFundTransactionsController } from "./clubFundTransactions.controller.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, clubFundTransactionsController.getAll);
router.get("/period/:periodId", requireAuth, requireAdmin, clubFundTransactionsController.getByPeriod);
router.post("/", requireAuth, requireAdmin, clubFundTransactionsController.create);

export default router;
