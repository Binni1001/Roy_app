import express from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { clubFundTransactionsController } from "./clubFundTransactions.controller.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, clubFundTransactionsController.getAll);
router.get("/period/:periodId", requireAuth, requireAdmin, clubFundTransactionsController.getByPeriod);
router.post("/", requireAuth, requireAdmin, clubFundTransactionsController.create);
router.post("/deposit", requireAuth, requireAdmin, clubFundTransactionsController.deposit);
router.post("/refund", requireAuth, requireAdmin, clubFundTransactionsController.refund);
router.put("/:id", requireAuth, requireAdmin, clubFundTransactionsController.update);
router.delete("/:id", requireAuth, requireAdmin, clubFundTransactionsController.remove);

export default router;
