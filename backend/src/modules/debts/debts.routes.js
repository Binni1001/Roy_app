import express from "express";
import { debtsController } from "./debts.controller.js";

const router = express.Router();

router.get("/", debtsController.getAll);
router.get("/period/:periodId", debtsController.getByPeriod);
router.get("/person/:personId", debtsController.getByPerson);
router.post("/", debtsController.create);
router.put("/:id/status", debtsController.updateStatus);

export default router;