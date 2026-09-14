import express from "express";
import { requireAuth, requireOwner } from "../../middleware/auth.js";
import { adminUsersController } from "./adminUsers.controller.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireOwner);

router.get("/", adminUsersController.list);
router.get("/groups", adminUsersController.groups);
router.put("/:id/groups", adminUsersController.assignGroups);
router.post("/", adminUsersController.invite);
router.delete("/:id", adminUsersController.revoke);

export default router;
