import express from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { tournamentsController } from "./tournaments.controller.js";

const router = express.Router();

router.get("/", requireAuth, tournamentsController.list);
router.get("/:id", requireAuth, tournamentsController.get);
router.post("/", requireAuth, requireAdmin, tournamentsController.create);
router.put("/:id", requireAuth, requireAdmin, tournamentsController.update);
router.put("/:id/configure", requireAuth, requireAdmin, tournamentsController.configure);
router.post("/:id/publish", requireAuth, requireAdmin, tournamentsController.publish);
router.post("/:id/knockout", requireAuth, requireAdmin, tournamentsController.buildKnockout);
router.put("/:id/groups/:groupId/matches/order", requireAuth, requireAdmin, tournamentsController.reorderGroupMatches);
router.put("/:id/matches/:matchId", requireAuth, requireAdmin, tournamentsController.saveMatch);
router.delete("/:id", requireAuth, requireAdmin, tournamentsController.remove);

export default router;
