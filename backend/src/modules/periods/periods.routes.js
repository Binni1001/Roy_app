import express from "express";
import { periodsController } from "./periods.controller.js";

const router = express.Router();

router.get("/", periodsController.getAll);
router.get("/:id", periodsController.getById);
router.post("/", periodsController.create);
router.put("/:id", periodsController.update);

export default router;