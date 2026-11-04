import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import {
  getWalletBalance,
  createTopUpOrder,
  verifyTopUpPayment,
  getWalletTransactions,
} from "../controllers/wallet.controller.js";

const router = express.Router();

// All wallet endpoints are strictly protected by user authentication
router.use(authMiddleware);

// GET /api/wallet - Get authenticated customer's wallet balance and summary
router.get("/", getWalletBalance);

// GET /api/wallet/transactions - Get paginated transaction history with filters
router.get("/transactions", getWalletTransactions);

// POST /api/wallet/topup/create-order - Initialize Razorpay order for wallet top-up
router.post("/topup/create-order", createTopUpOrder);

// POST /api/wallet/topup/verify - Cryptographically verify payment signature & credit wallet idempotently
router.post("/topup/verify", verifyTopUpPayment);

export default router;
