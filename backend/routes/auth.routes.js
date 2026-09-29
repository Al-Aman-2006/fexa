const express = require("express");

const router = express.Router();

const {
  register,
  login,
  verifyOtpController,
  resendOtpController,
  forgotPasswordController,
  resetPasswordController,
  logout,
  checkSession,
} = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");


// Register
router.post("/register", register);

// Login
router.post("/login", login);

// Logout
router.post("/logout", logout);

// Check Session
router.get("/session", authMiddleware, checkSession);

// Verify OTP
router.post("/verify-otp",verifyOtpController);

// Resend OTP
router.post("/resend-otp",resendOtpController);


router.post("/forgot-password",forgotPasswordController);

router.post("/reset-password/:token",resetPasswordController);

module.exports = router;