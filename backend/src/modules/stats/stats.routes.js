const express     = require("express");
const router      = express.Router();
const controller  = require("./stats.controller");
const { requireAuth } = require("../../middlewares/auth.middleware");

router.get("/",   controller.getStats);
router.get("/me", requireAuth, controller.getMyStats);

module.exports = router;