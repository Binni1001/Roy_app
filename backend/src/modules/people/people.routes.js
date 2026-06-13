import express from "express";
import { peopleController } from "./people.controller.js";

const router = express.Router();

router.get("/", peopleController.getAll);
router.get("/:id", peopleController.getById);
router.post("/", peopleController.create);
router.put("/:id", peopleController.update);
router.delete("/:id", peopleController.remove);

export default router;
