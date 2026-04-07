const express            = require("express");
const router             = express.Router();
const requestsController = require("./requests.controller");

router.get("/",                  requestsController.getAll);
router.get("/:id",               requestsController.getById);
router.post("/",                 requestsController.create);
router.put("/:id/approve",       requestsController.approve);
router.put("/:id/reject",        requestsController.reject);
router.put("/:id/return",        requestsController.returnRequest);
router.put("/:id",               requestsController.update);
router.delete("/:id",            requestsController.remove);

module.exports = router;