const express    = require("express");
const router     = express.Router();
const controller = require("./reservations.controller");

router.get("/",           controller.getAll);
router.get("/:id",        controller.getById);
router.post("/",          controller.create);
router.put("/:id/approve",controller.approve);
router.put("/:id/occupy", controller.occupy);
router.put("/:id/release",controller.release);
router.put("/:id/cancel", controller.cancel);
router.delete("/:id",     controller.remove);

module.exports = router;