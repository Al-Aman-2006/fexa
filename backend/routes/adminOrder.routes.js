import express from "express";
import adminMiddleware from "../middlewares/admin.middleware.js";
import {
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  updateOrderTracking,
  updatePaymentStatus,
} from "../controllers/adminOrder.controller.js";
import {
  approveItemReturn,
  rejectItemReturn,
  downloadOrderInvoicePDF,
} from "../controllers/order.controller.js";

const router = express.Router();

// Require admin authentication & authorization on all admin order endpoints
router.use(adminMiddleware);

// Order Listing & Search with Filters & Statistics
router.get("/", getAdminOrders);

// Single Order Detailed Inspection Snapshot
router.get("/:orderId", getAdminOrderById);

// Download Admin Order Invoice PDF
router.get("/:orderId/invoice", downloadOrderInvoicePDF);

// Update Order Fulfillment Status (with state machine validation)
router.patch("/:orderId/status", updateOrderStatus);
router.put("/:orderId/status", updateOrderStatus);

// Update Shipment Tracking Details
router.patch("/:orderId/tracking", updateOrderTracking);
router.put("/:orderId/tracking", updateOrderTracking);

// Update Payment Status (e.g. COD reconciliation)
router.patch("/:orderId/payment-status", updatePaymentStatus);
router.put("/:orderId/payment-status", updatePaymentStatus);

// Return Request Review Actions
router.post("/:orderId/items/:itemId/approve-return", approveItemReturn);
router.post("/:orderId/items/:itemId/reject-return", rejectItemReturn);

export default router;
