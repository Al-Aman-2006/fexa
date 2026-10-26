import express from "express";
import jwt from "jsonwebtoken";
import authMiddleware from "../middlewares/auth.middleware.js";
import {
  getAvailableCoupons,
  applyCoupon,
  removeCoupon,
} from "../controllers/coupon.controller.js";

const router = express.Router();

// Optional auth helper for public offer discovery
const optionalAuth = (req, res, next) => {
  try {
    let token = null;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
  } catch (err) {
    // Ignore invalid token for optional auth
  }
  next();
};

// Customer routes
router.get("/available", optionalAuth, getAvailableCoupons);
router.post("/apply", authMiddleware, applyCoupon);
router.post("/remove", authMiddleware, removeCoupon);

export default router;
