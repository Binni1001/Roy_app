import express from "express";
import { requireAdmin, requireAuth, requireSelfPersonOrAdmin } from "../../middleware/auth.js";
import { guestAttendancesController } from "./guestAttendances.controller.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, guestAttendancesController.getAll);
router.get("/session/:sessionId", requireAuth, requireAdmin, guestAttendancesController.getBySession);
router.get("/person/:personId", requireAuth, requireSelfPersonOrAdmin(), guestAttendancesController.getByPerson);
router.get("/:id", requireAuth, requireAdmin, guestAttendancesController.getById);
router.post("/", requireAuth, requireAdmin, guestAttendancesController.create);
router.put("/:id", requireAuth, requireAdmin, guestAttendancesController.update);
router.delete("/:id", requireAuth, requireAdmin, guestAttendancesController.remove);

export default router;
