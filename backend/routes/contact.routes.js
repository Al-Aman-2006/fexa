const express = require("express");
const router = express.Router();
const {
  submitContactMessage,
  getContactReasons,
} = require("../controllers/contact.controller");

// GET /api/contact/reasons - Return allowed contact reasons
router.get("/reasons", getContactReasons);

// POST /api/contact - Submit customer inquiry
router.post("/", submitContactMessage);

module.exports = router;
