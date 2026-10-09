import express from "express";
import { requireAuth, requireOwner } from "../../middleware/auth.js";
import { shuttleLoansController as controller } from "./shuttleLoans.controller.js";

const router = express.Router();
router.get("/me", requireAuth, controller.mine);
router.get("/period/:periodId/people", requireAuth, requireOwner, controller.candidates);
router.get("/period/:periodId", requireAuth, requireOwner, controller.byPeriod);
router.post("/", requireAuth, requireOwner, controller.create);
router.post("/:id/repay", requireAuth, requireOwner, controller.repay);
router.post("/:id/cancel", requireAuth, requireOwner, controller.cancel);
export default router;
