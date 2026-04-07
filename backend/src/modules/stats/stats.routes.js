const express    = require("express");
const router     = express.Router();
const controller = require("./stats.controller");

router.get("/", controller.getStats);

module.exports = router;