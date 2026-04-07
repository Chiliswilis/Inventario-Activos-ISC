const express    = require("express");
const router     = express.Router();
const controller = require("./categories.controller");

router.get("/",           controller.getAll);
router.get("/assets",     controller.getAssets);
router.get("/consumables",controller.getConsumables);

module.exports = router;