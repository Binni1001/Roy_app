import express from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { shuttleSettlementsController } from "./shuttleSettlements.controller.js";

const router = express.Router();

router.get("/period/:periodId/preview", requireAuth, requireAdmin, shuttleSettlementsController.preview);
router.post("/period/:periodId/settle", requireAuth, requireAdmin, shuttleSettlementsController.settle);

export default router;
