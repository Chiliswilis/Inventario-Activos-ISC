const express    = require("express");
const router     = express.Router();
const controller = require("./assets.controller");

router.get("/",           controller.getAll);
router.get("/summary",    controller.getSummary);
router.get("/:id/logs",   controller.getLogs);
router.get("/:id",        controller.getById);
router.post("/",          controller.create);
router.put("/:id",        controller.update);
router.delete("/:id",     controller.remove);

module.exports = router;