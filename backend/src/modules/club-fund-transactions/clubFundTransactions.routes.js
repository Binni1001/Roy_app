import express from "express";
import { clubFundTransactionsController } from "./clubFundTransactions.controller.js";

const router = express.Router();

router.get("/", clubFundTransactionsController.getAll);
router.get("/period/:periodId", clubFundTransactionsController.getByPeriod);
router.post("/", clubFundTransactionsController.create);

export default router;