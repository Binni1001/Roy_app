import express from "express";
import { requireAuth, requireOwner } from "../../middleware/auth.js";
import { adminUsersController } from "./adminUsers.controller.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireOwner);

router.get("/", adminUsersController.list);
router.post("/", adminUsersController.invite);

export default router;
