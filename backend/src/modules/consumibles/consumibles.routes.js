const express               = require("express");
const router                = express.Router();
const consumiblesController = require("./consumibles.controller");

router.get("/",     consumiblesController.getAll);
router.get("/:id",  consumiblesController.getById);
router.post("/",    consumiblesController.create);
router.put("/:id",  consumiblesController.update);
router.delete("/:id", consumiblesController.remove);

module.exports = router;