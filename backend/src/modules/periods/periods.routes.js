import express from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { periodsController } from "./periods.controller.js";

const router = express.Router();

router.get("/", requireAuth, periodsController.getAll);
router.get("/:id", requireAuth, periodsController.getById);
router.post("/", requireAuth, requireAdmin, periodsController.create);
router.put("/:id", requireAuth, requireAdmin, periodsController.update);

export default router;
