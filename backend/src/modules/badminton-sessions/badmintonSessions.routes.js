import express from "express";
import { badmintonSessionsController } from "./badmintonSessions.controller.js";

const router = express.Router();

router.get("/", badmintonSessionsController.getAll);
router.get("/period/:periodId", badmintonSessionsController.getByPeriod);
router.get("/:id", badmintonSessionsController.getById);
router.post("/", badmintonSessionsController.create);
router.put("/:id", badmintonSessionsController.update);
router.delete("/:id", badmintonSessionsController.remove);

export default router;
