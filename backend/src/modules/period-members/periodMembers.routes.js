import express from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { periodMembersController } from "./periodMembers.controller.js";

const router = express.Router();

router.get("/period/:periodId", requireAuth, requireAdmin, periodMembersController.getByPeriod);
router.get("/:id", requireAuth, requireAdmin, periodMembersController.getById);
router.post("/bulk", requireAuth, requireAdmin, periodMembersController.createBulk);
router.post("/", requireAuth, requireAdmin, periodMembersController.create);
router.put("/:id", requireAuth, requireAdmin, periodMembersController.update);
router.delete("/:id", requireAuth, requireAdmin, periodMembersController.remove);

export default router;
