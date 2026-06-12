import express from "express";
import { shuttleExpensesController } from "./shuttleExpenses.controller.js";

const router = express.Router();

router.get("/", shuttleExpensesController.getAll);
router.get("/period/:periodId", shuttleExpensesController.getByPeriod);
router.post("/", shuttleExpensesController.create);
router.put("/:id", shuttleExpensesController.update);
router.delete("/:id", shuttleExpensesController.remove);

export default router;