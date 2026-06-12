import express from "express";
import { peopleController } from "./people.controller.js";

const router = express.Router();

router.get("/", peopleController.getAll);
router.get("/:id", peopleController.getById);
router.post("/", peopleController.create);

export default router;