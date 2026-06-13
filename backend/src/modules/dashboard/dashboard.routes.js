import express from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { dashboardController } from "./dashboard.controller.js";

const router = express.Router();

router.get("/period/:periodId", requireAuth, requireAdmin, dashboardController.getPeriodDashboard);

export default router;
