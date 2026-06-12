import express from "express";
import { periodMembersController } from "./periodMembers.controller.js";

const router = express.Router();

router.get("/period/:periodId", periodMembersController.getByPeriod);
router.get("/:id", periodMembersController.getById);
router.post("/", periodMembersController.create);
router.put("/:id", periodMembersController.update);
router.delete("/:id", periodMembersController.remove);

export default router;