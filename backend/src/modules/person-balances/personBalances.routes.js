import express from "express";
import { requireAdmin, requireAuth, requireSelfPersonOrAdmin } from "../../middleware/auth.js";
import { personBalancesController } from "./personBalances.controller.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, personBalancesController.getAll);

router.get(
  "/person/:personId",
  requireAuth,
  requireSelfPersonOrAdmin(),
  personBalancesController.getByPerson
);

router.get(
  "/person/:personId/transactions",
  requireAuth,
  requireSelfPersonOrAdmin(),
  personBalancesController.getTransactions
);

export default router;
