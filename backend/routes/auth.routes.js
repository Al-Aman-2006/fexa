import express from "express";
import {
  register,
  login,
  verifyOtpController,
  resendOtpController,
  forgotPasswordController,
  resetPasswordController,
  logout,
  checkSession,
  googleLoginController,
} from "../controllers/auth.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

// Register
router.post("/register", register);

// Login
router.post("/login", login);

// Google Login
router.post("/google", googleLoginController);

// Logout
router.post("/logout", logout);

// Check Session
router.get("/session", authMiddleware, checkSession);

// Verify OTP
router.post("/verify-otp", verifyOtpController);

// Resend OTP
router.post("/resend-otp", resendOtpController);

router.post("/forgot-password", forgotPasswordController);

router.post("/reset-password/:token", resetPasswordController);

export default router;