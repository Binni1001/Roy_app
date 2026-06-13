import express from "express";
import { guestAttendancesController } from "./guestAttendances.controller.js";

const router = express.Router();

router.get("/", guestAttendancesController.getAll);
router.get("/session/:sessionId", guestAttendancesController.getBySession);
router.get("/person/:personId", guestAttendancesController.getByPerson);
router.get("/:id", guestAttendancesController.getById);
router.post("/", guestAttendancesController.create);
router.put("/:id", guestAttendancesController.update);
router.delete("/:id", guestAttendancesController.remove);

export default router;
