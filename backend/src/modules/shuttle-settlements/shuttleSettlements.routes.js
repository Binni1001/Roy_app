import express from "express";
import { shuttleSettlementsController } from "./shuttleSettlements.controller.js";

const router = express.Router();

router.get("/period/:periodId/preview", shuttleSettlementsController.preview);
router.post("/period/:periodId/settle", shuttleSettlementsController.settle);

export default router;