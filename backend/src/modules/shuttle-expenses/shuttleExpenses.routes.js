import express from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { shuttleExpensesController } from "./shuttleExpenses.controller.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, shuttleExpensesController.getAll);
router.get("/period/:periodId", requireAuth, requireAdmin, shuttleExpensesController.getByPeriod);
router.post("/", requireAuth, requireAdmin, shuttleExpensesController.create);
router.post("/with-fund-split", requireAuth, requireAdmin, shuttleExpensesController.createWithFundSplit);
router.put("/:id", requireAuth, requireAdmin, shuttleExpensesController.update);
router.delete("/:id", requireAuth, requireAdmin, shuttleExpensesController.remove);

export default router;
