import express from "express";
import { personBalancesController } from "./personBalances.controller.js";

const router = express.Router();

router.get("/", personBalancesController.getAll);

router.get(
  "/person/:personId",
  personBalancesController.getByPerson
);

router.get(
  "/person/:personId/transactions",
  personBalancesController.getTransactions
);

export default router;