import express from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { peopleController } from "./people.controller.js";

const router = express.Router();

router.get("/me", requireAuth, peopleController.getMe);
router.post("/me", requireAuth, peopleController.createMe);
router.put("/me", requireAuth, peopleController.updateMe);
router.get("/", requireAuth, requireAdmin, peopleController.getAll);
router.get("/:id", requireAuth, requireAdmin, peopleController.getById);
router.post("/", requireAuth, requireAdmin, peopleController.create);
router.put("/:id", requireAuth, requireAdmin, peopleController.update);
router.delete("/:id", requireAuth, requireAdmin, peopleController.remove);

export default router;
