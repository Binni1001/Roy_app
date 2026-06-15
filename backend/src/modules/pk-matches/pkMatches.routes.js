import express from "express";
import { requireAuth } from "../../middleware/auth.js";
import { pkMatchesController } from "./pkMatches.controller.js";

const router = express.Router();

// Public read (authenticated users only)
router.get("/leaderboard", requireAuth, pkMatchesController.getLeaderboard);
router.get("/people", requireAuth, pkMatchesController.getPublicPeople);
router.get("/person/:personId", requireAuth, pkMatchesController.getByPerson);
router.get("/", requireAuth, pkMatchesController.getAll);
router.get("/:id", requireAuth, pkMatchesController.getById);

// Write (any authenticated user can challenge / update their own)
router.post("/", requireAuth, pkMatchesController.create);
router.put("/:id", requireAuth, pkMatchesController.update);

export default router;
