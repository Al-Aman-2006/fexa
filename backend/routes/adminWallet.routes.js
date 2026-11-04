import express from "express";
import adminMiddleware from "../middlewares/admin.middleware.js";
import {
  getAdminWalletRefunds,
  getAdminWalletTransactionById,
} from "../controllers/adminWallet.controller.js";

const router = express.Router();

// Strict Admin protection for all wallet management endpoints
router.use(adminMiddleware);

// GET /api/admin/wallet-refunds - List transactions with filters, search, pagination & live stats
router.get("/", getAdminWalletRefunds);

// GET /api/admin/wallet-refunds/:transactionId - Detailed inspection modal data
router.get("/:transactionId", getAdminWalletTransactionById);

export default router;

