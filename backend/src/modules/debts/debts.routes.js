import express from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { debtsController } from "./debts.controller.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, debtsController.getAll);
router.get("/period/:periodId", requireAuth, requireAdmin, debtsController.getByPeriod);
router.get("/person/:personId", requireAuth, debtsController.getByPerson);
router.post("/", requireAuth, requireAdmin, debtsController.create);
router.put("/:id/status", requireAuth, requireAdmin, debtsController.updateStatus);

export default router;
