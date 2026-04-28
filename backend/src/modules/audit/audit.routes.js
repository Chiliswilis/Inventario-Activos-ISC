const express        = require("express");
const router         = express.Router();
const { requireAuth }  = require("../../middlewares/auth.middleware");
const { getAll }     = require("./audit.controller");

// Solo administrador puede ver los logs
router.get("/", requireAuth, (req, res, next) => {
  if (req.user?.role !== "administrador")
    return res.status(403).json({ message: "Acceso denegado" });
  next();
}, getAll);

module.exports = router;