import express from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { personBalancesController } from "./personBalances.controller.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, personBalancesController.getAll);

router.get(
  "/person/:personId",
  requireAuth,
  personBalancesController.getByPerson
);

router.get(
  "/person/:personId/transactions",
  requireAuth,
  personBalancesController.getTransactions
);

export default router;
