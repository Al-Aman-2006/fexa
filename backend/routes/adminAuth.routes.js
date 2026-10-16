const express = require("express");
const router = express.Router();
const {
  adminLogin,
  checkAdminSession,
  adminLogout,
} = require("../controllers/adminAuth.controller");
const adminMiddleware = require("../middlewares/admin.middleware");

router.post("/login", adminLogin);
router.get("/session", adminMiddleware, checkAdminSession);
router.post("/logout", adminLogout);

module.exports = router;
