import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getRazorpayKey,
  createRazorpayOrder,
  verifyRazorpayPayment,
  recordPaymentFailure,
  checkOrderStatus,
  handleRazorpayWebhook,
  requestItemReturn,
  approveItemReturn,
  rejectItemReturn,
} from "../controllers/order.controller.js";

const router = express.Router();

// Razorpay public webhook (called directly by Razorpay servers)
router.post("/razorpay/webhook", handleRazorpayWebhook);

// Protected routes (require user login)
router.use(authMiddleware);

// Razorpay endpoints
router.get("/razorpay/key", getRazorpayKey);
router.post("/razorpay/create-order", createRazorpayOrder);
router.post("/razorpay/verify-payment", verifyRazorpayPayment);
router.post("/razorpay/payment-failed", recordPaymentFailure);
router.get("/razorpay/check-status/:orderId", checkOrderStatus);

// POST /api/orders - Create or convert order from current cart (COD or standard)
router.post("/", createOrder);

// GET /api/orders - Get user's order history
router.get("/", getMyOrders);

// Returns & Refunds
router.post("/:orderId/items/:itemId/return", requestItemReturn);
router.post("/:orderId/items/:itemId/approve-return", approveItemReturn);
router.post("/:orderId/items/:itemId/reject-return", rejectItemReturn);

// GET /api/orders/:id - Get specific order details
router.get("/:id", getOrderById);

export default router;
