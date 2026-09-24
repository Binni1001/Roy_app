import express from "express";
import { requireAuth } from "../../middleware/auth.js";
import { sessionPlanningController } from "./sessionPlanning.controller.js";

const router = express.Router();
router.get("/period/:periodId/draft-inputs", requireAuth, sessionPlanningController.draftInputs);
router.put("/period/:periodId/people/:personId/profile", requireAuth, sessionPlanningController.saveProfile);
router.post("/period/:periodId/draft-preview", requireAuth, sessionPlanningController.preview);
router.get("/period/:periodId", requireAuth, sessionPlanningController.get);
router.put("/period/:periodId/people/:personId", requireAuth, sessionPlanningController.save);
export default router;
