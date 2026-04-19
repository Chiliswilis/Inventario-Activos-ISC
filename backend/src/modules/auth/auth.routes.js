const express        = require("express");
const router         = express.Router();
const authController = require("./auth.controller");
const { requireAuth } = require("../../middlewares/auth.middleware");

router.post("/login",    authController.login);
router.post("/register", authController.register);
router.post("/recover",  authController.recover);

// Endpoint de revalidación: verifica que x-user-id siga siendo válido
router.get("/me", requireAuth, authController.me);

module.exports = router;