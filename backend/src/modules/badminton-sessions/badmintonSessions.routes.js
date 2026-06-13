import express from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { badmintonSessionsController } from "./badmintonSessions.controller.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, badmintonSessionsController.getAll);
router.get("/period/:periodId", requireAuth, badmintonSessionsController.getByPeriod);
router.get("/:id", requireAuth, requireAdmin, badmintonSessionsController.getById);
router.post("/", requireAuth, requireAdmin, badmintonSessionsController.create);
router.put("/:id", requireAuth, requireAdmin, badmintonSessionsController.update);
router.delete("/:id", requireAuth, requireAdmin, badmintonSessionsController.remove);

export default router;
