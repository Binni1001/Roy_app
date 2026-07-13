import express from "express";
import { requireAdmin, requireAuth, requireOwner } from "../../middleware/auth.js";
import { pkMatchesController } from "./pkMatches.controller.js";

const router = express.Router();

router.get("/leaderboard", requireAuth, pkMatchesController.getLeaderboard);
router.get("/people", requireAuth, pkMatchesController.getPublicPeople);
router.get("/me", requireAuth, pkMatchesController.getMyMatches);
router.get("/person/:personId", requireAuth, pkMatchesController.getByPerson);
router.get("/", requireAuth, pkMatchesController.getAll);
router.get("/:id", requireAuth, pkMatchesController.getById);

router.post("/bulk", requireAuth, pkMatchesController.createBulk);
router.post("/", requireAuth, pkMatchesController.create);
router.post("/:id/finalize", requireAuth, pkMatchesController.finalize);
router.post("/:id/void", requireAuth, requireOwner, pkMatchesController.voidResult);
router.put("/:id", requireAuth, pkMatchesController.update);
router.delete("/:id", requireAuth, requireAdmin, pkMatchesController.remove);

export default router;
