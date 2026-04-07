const express        = require("express");
const router         = express.Router();
const authController = require("./auth.controller");

router.post("/login",    authController.login);
router.post("/register", authController.register);
router.post("/recover",  authController.recover);

module.exports = router;