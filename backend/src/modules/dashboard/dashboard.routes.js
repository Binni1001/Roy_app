import express from "express";
import { dashboardController } from "./dashboard.controller.js";

const router = express.Router();

router.get("/period/:periodId", dashboardController.getPeriodDashboard);

export default router;