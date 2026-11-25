import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import Wallet from "../models/wallet.model.js";
import { restoreOrderStock } from "../services/inventory.service.js";

import { resolveImageUrl } from "../services/imageResolver.service.js";
import {
  calculateItemRefund,
  normalizeOrderWithAllocations,
  roundToPaise,
} from "../utils/couponAllocation.js";
import { getRazorpayInstance } from "../config/razorpay.js";

// ========================================================
// AUTHORITATIVE ORDER STATUS TRANSITION MATRIX
// ========================================================
export const ALLOWED_STATUS_TRANSITIONS = {
  Pending: ["Confirmed", "Processing", "Cancelled"],
  Confirmed: ["Processing", "Dispatched", "Shipped", "Cancelled"],
  Processing: ["Dispatched", "Shipped", "Cancelled"],
  Dispatched: ["Out for Delivery", "Delivered", "Cancelled"],
  Shipped: ["Out for Delivery", "Delivered", "Cancelled"],
  "Out for Delivery": ["Delivered", "Cancelled"],
  Delivered: [], // Terminal fulfillment state for admin - Return requests must be initiated exclusively by users
  Cancelled: [], // Terminal
  "Return Requested": ["Return Approved", "Return Rejected"],
  "Return Approved": ["Returned", "Refunded"],
  "Return Rejected": [],
  Returned: ["Refunded"],
  Refunded: [],
};

// Fulfillment statuses that require verified payment (or legitimate COD)
export const FULFILLMENT_STATUSES = [
  "Dispatched",
  "Shipped",
  "Out for Delivery",
  "Delivered",
];

// Helper: Determine whether payment status blocks shipping or delivery
export const getPaymentFulfillmentBlock = (order) => {
  if (order.paymentStatus === "Failed") {
    return {
      blocked: true,
      reason: "Payment has failed. This order cannot be shipped or delivered until payment is successfully completed.",
    };
  }

  // Non-COD orders require verified "Paid" status before fulfillment
  if (order.paymentMethod !== "COD" && order.paymentStatus !== "Paid") {
    return {
      blocked: true,
      reason: "Online payment is pending verification. This order cannot be shipped or delivered until payment is confirmed as Paid.",
    };
  }

  return { blocked: false, reason: null };
};

// ========================================================
// 1. GET ALL ADMIN ORDERS WITH SEARCH, FILTERS & STATS
// ========================================================
export const getAdminOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      orderStatus = "All",
      paymentStatus = "All",
      paymentMethod = "All",
      startDate = "",
      endDate = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Build filter query
    const filter = {};

    // 1. Order Status Filter
    if (orderStatus && orderStatus !== "All") {
      if (orderStatus === "Shipped") {
        filter.orderStatus = { $in: ["Shipped", "Dispatched"] };
      } else {
        filter.orderStatus = orderStatus;
      }
    }

    // 2. Payment Status Filter
    if (paymentStatus && paymentStatus !== "All") {
      filter.paymentStatus = paymentStatus;
    }

    // 3. Payment Method Filter
    if (paymentMethod && paymentMethod !== "All") {
      filter.paymentMethod = paymentMethod;
    }

    // 4. Date Range Filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // 5. Search Filter (orderNumber, customer name, email, phone, product name)
    const trimmedSearch = search ? String(search).trim() : "";
    if (trimmedSearch) {
      // Find matching users first if searching for patron name or email
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: trimmedSearch, $options: "i" } },
          { email: { $regex: trimmedSearch, $options: "i" } },
          { phone: { $regex: trimmedSearch, $options: "i" } },
        ],
      }).select("_id");

      const userIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { orderNumber: { $regex: trimmedSearch, $options: "i" } },
        { "shippingAddress.fullName": { $regex: trimmedSearch, $options: "i" } },
        { "shippingAddress.phone": { $regex: trimmedSearch, $options: "i" } },
        { "shippingAddress.city": { $regex: trimmedSearch, $options: "i" } },
        { "items.name": { $regex: trimmedSearch, $options: "i" } },
        { user: { $in: userIds } },
      ];
    }

    // Sort order
    const sort = {};
    const validSortFields = ["createdAt", "totalAmount", "orderNumber", "orderStatus", "paymentStatus"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    sort[sortField] = sortOrder === "asc" ? 1 : -1;

    // Execute query with pagination and user population
    const [orders, totalOrdersCount] = await Promise.all([
      Order.find(filter)
        .populate("user", "name email phone")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filter),
    ]);

    // Calculate aggregated statistics from actual MongoDB records
    // Failed payment attempts are explicitly excluded from paid sales totals
    const [
      totalCount,
      pendingCount,
      processingCount,
      shippedCount,
      deliveredCount,
      cancelledCount,
      returnRequestsCount,
      revenueResult,
    ] = await Promise.all([
      Order.countDocuments({}),
      Order.countDocuments({ orderStatus: { $in: ["Pending", "Confirmed"] } }),
      Order.countDocuments({ orderStatus: "Processing" }),
      Order.countDocuments({ orderStatus: { $in: ["Dispatched", "Shipped", "Out for Delivery"] } }),
      Order.countDocuments({ orderStatus: "Delivered" }),
      Order.countDocuments({ orderStatus: "Cancelled" }),
      Order.countDocuments({
        $or: [
          { orderStatus: "Return Requested" },
          { "items.itemStatus": "Return Requested" },
          { hasReturns: true },
        ],
      }),
      Order.aggregate([
        {
          $match: {
            $or: [
              { paymentStatus: "Paid" },
              { paymentMethod: "COD", orderStatus: "Delivered" },
            ],
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
            totalRefunded: { $sum: "$totalRefundedAmount" },
          },
        },
      ]),
    ]);

    const netRecognizedRevenue =
      revenueResult.length > 0
        ? Math.max(0, (revenueResult[0].totalRevenue || 0) - (revenueResult[0].totalRefunded || 0))
        : 0;

    const stats = {
      totalOrders: totalCount,
      pendingOrders: pendingCount,
      processingOrders: processingCount,
      shippedOrders: shippedCount,
      deliveredOrders: deliveredCount,
      cancelledOrders: cancelledCount,
      returnRequests: returnRequestsCount,
      recognizedRevenue: roundToPaise(netRecognizedRevenue),
    };

    // Normalize discount allocations for each order snapshot
    const normalizedOrders = orders.map((order) => {
      const normalized = normalizeOrderWithAllocations(order);
      const paymentBlock = getPaymentFulfillmentBlock(order);
      return {
        ...normalized,
        customerName:
          order.shippingAddress?.fullName || order.user?.name || "Private Patron",
        customerEmail: order.user?.email || "N/A",
        customerPhone: order.shippingAddress?.phone || order.user?.phone || "N/A",
        isFulfillmentBlocked: paymentBlock.blocked,
        paymentBlockReason: paymentBlock.reason,
      };
    });

    const totalPages = Math.ceil(totalOrdersCount / limitNum) || 1;

    return res.status(200).json({
      success: true,
      orders: normalizedOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalOrders: totalOrdersCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      stats,
    });
  } catch (error) {
    console.error("Get admin orders error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve orders list.",
    });
  }
};

// ========================================================
// 2. GET SINGLE ADMIN ORDER BY ID WITH COMPLETE SNAPSHOT
// ========================================================
export const getAdminOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order identifier format.",
      });
    }

    const order = await Order.findById(orderId)
      .populate("user", "name email phone addresses")
      .populate("items.product", "name images price variants")
      .populate("statusHistory.changedBy", "name email")
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    const normalized = normalizeOrderWithAllocations(order);
    const paymentBlock = getPaymentFulfillmentBlock(order);

    // Filter allowed transitions to exclude shipping/delivery if payment is unverified or failed, and ensure Return Requested is never offered to admins
    let allowedNextStatuses = (ALLOWED_STATUS_TRANSITIONS[order.orderStatus] || []).filter(
      (st) => st !== "Return Requested"
    );
    if (paymentBlock.blocked) {
      allowedNextStatuses = allowedNextStatuses.filter(
        (st) => !FULFILLMENT_STATUSES.includes(st)
      );
    }

   
   // Attach and resolve product images to order items
if (Array.isArray(normalized.items)) {
  normalized.items = await Promise.all(
    normalized.items.map(async (it) => {
      let itemImage = it.image;

      if (
        !itemImage &&
        it.product &&
        Array.isArray(it.product.images) &&
        it.product.images.length > 0
      ) {
        itemImage = it.product.images[0];
      }

      return {
        ...it,
        image: (await resolveImageUrl(itemImage)) || null,
      };
    })
  );
}
    return res.status(200).json({
      success: true,
      order: {
        ...normalized,
        customerName:
          order.shippingAddress?.fullName || order.user?.name || "Private Patron",
        customerEmail: order.user?.email || "N/A",
        customerPhone: order.shippingAddress?.phone || order.user?.phone || "N/A",
        allowedNextStatuses,
        isFulfillmentBlocked: paymentBlock.blocked,
        paymentBlockReason: paymentBlock.reason,
      },
    });
  } catch (error) {
    console.error("Get admin order details error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve order details.",
    });
  }
};

// ========================================================
// 3. UPDATE ORDER STATUS (WITH TRANSITION VALIDATION & INVENTORY INTEGRITY)
// ========================================================
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, note = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order identifier format.",
      });
    }

    if (!status || typeof status !== "string") {
      return res.status(400).json({
        success: false,
        message: "Target order status is required.",
      });
    }

    const targetStatus = status.trim();

    // Business Rule: Administrators cannot initiate return requests
    if (targetStatus === "Return Requested") {
      return res.status(400).json({
        success: false,
        message: "Administrators cannot initiate return requests. Return requests must be initiated exclusively by the customer.",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found in atelier ledger.",
      });
    }

    const currentStatus = order.orderStatus;

    // Idempotency: If already at target status, return success without duplicate side-effects
    if (currentStatus === targetStatus) {
      return res.status(200).json({
        success: true,
        message: `Order is already marked as "${targetStatus}".`,
        order: normalizeOrderWithAllocations(order.toObject ? order.toObject() : order),
      });
    }

    // PAYMENT VALIDATION CHECK: Prevent shipping / delivery when payment is failed or unverified online
    if (FULFILLMENT_STATUSES.includes(targetStatus)) {
      const paymentBlock = getPaymentFulfillmentBlock(order);
      if (paymentBlock.blocked) {
        return res.status(400).json({
          success: false,
          message: paymentBlock.reason,
          persistedPaymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
        });
      }
    }

    // Verify Transition Legality
    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: `Illegal transition: Cannot change order status from "${currentStatus}" to "${targetStatus}". Allowed next transitions: ${
          allowedTransitions.length > 0 ? allowedTransitions.join(", ") : "None (Terminal Status)"
        }.`,
      });
    }

    // Business Rule: Delivered orders cannot be cancelled via normal status dropdown
    if (currentStatus === "Delivered" && targetStatus === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Delivered orders cannot be cancelled. Use the official Return and Refund workflow.",
      });
    }

    // Record Status Audit History identifiers
    const adminIdentifier = req.user?._id || req.admin?._id || null;
    const adminEmail = req.user?.email || req.admin?.email || "Admin";

    // Restock Inventory on Cancellation (Idempotent: only restores if inventory was deducted and not yet restored)
    if (targetStatus === "Cancelled") {
      await restoreOrderStock(order);
      for (const item of order.items) {
        if (item.itemStatus !== "Cancelled") {
          item.itemStatus = "Cancelled";
          item.cancelledAt = new Date();
          item.cancellationReason = `Order marked as Cancelled by administrator (${adminEmail}).`;
        }
      }

      // If order was Paid, process wallet refund idempotently
      if (order.paymentStatus === "Paid" && order.user) {
        const remainingRefund = Math.max(0, (order.totalAmount || 0) - (order.totalRefundedAmount || 0));
        if (remainingRefund > 0) {
          try {
            const customerId = order.user._id || order.user;
            let userWallet = await Wallet.findOne({ user: customerId });
            if (!userWallet) {
              userWallet = await Wallet.create({ user: customerId, balance: 0, transactions: [] });
            }
            const balBefore = roundToPaise(userWallet.balance);
            const balAfter = roundToPaise(balBefore + remainingRefund);
            const txId = `TXN-RFND-ADMIN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

            userWallet.balance = balAfter;
            userWallet.transactions.push({
              transactionId: txId,
              type: "Cancellation Refund",
              amount: remainingRefund,
              direction: "Credit",
              description: `Administrative refund for cancellation of order ${order.orderNumber}`,
              referenceId: order.orderNumber,
              orderId: order._id,
              balanceBefore: balBefore,
              balanceAfter: balAfter,
              status: "Completed",
              createdAt: new Date(),
            });
            await userWallet.save();

            order.totalRefundedAmount = roundToPaise((order.totalRefundedAmount || 0) + remainingRefund);
            for (const item of order.items) {
              if (item.refundStatus !== "Refunded") {
                item.refundStatus = "Refunded";
                item.refundedAt = new Date();
                item.refundTransactionId = txId;
                item.refundAmount = item.discountedLineAmount || item.lineTotal || 0;
              }
            }
          } catch (wErr) {
            console.error("Admin order cancellation wallet refund error:", wErr);
          }
        }
      }
    }

    if (!Array.isArray(order.statusHistory)) {
      order.statusHistory = [];
    }

    order.statusHistory.push({
      previousStatus: currentStatus,
      newStatus: targetStatus,
      changedBy: adminIdentifier,
      adminEmail,
      timestamp: new Date(),
      note: note.trim() || `Status updated from ${currentStatus} to ${targetStatus} by administration.`,
    });

    // Update Order Status (keeping paymentStatus completely separate!)
    order.orderStatus = targetStatus;

    // If order was Shipped or Dispatched, ensure dispatchedAt is recorded
    if ((targetStatus === "Shipped" || targetStatus === "Dispatched") && !order.trackingInfo?.dispatchedAt) {
      if (!order.trackingInfo) order.trackingInfo = {};
      order.trackingInfo.dispatchedAt = new Date();
    }

    await order.save();

    const freshOrder = await Order.findById(orderId)
      .populate("user", "name email phone addresses")
      .populate("items.product", "name images price variants")
      .populate("statusHistory.changedBy", "name email")
      .lean();

    const normalized = normalizeOrderWithAllocations(freshOrder || (order.toObject ? order.toObject() : order));
    const paymentBlock = getPaymentFulfillmentBlock(order);

    let allowedNextStatuses = (ALLOWED_STATUS_TRANSITIONS[targetStatus] || []).filter(
      (st) => st !== "Return Requested"
    );
    if (paymentBlock.blocked) {
      allowedNextStatuses = allowedNextStatuses.filter(
        (st) => !FULFILLMENT_STATUSES.includes(st)
      );
    }

if (Array.isArray(normalized.items)) {
  normalized.items = await Promise.all(
    normalized.items.map(async (it) => {
      let itemImage = it.image;

      if (
        !itemImage &&
        it.product &&
        Array.isArray(it.product.images) &&
        it.product.images.length > 0
      ) {
        itemImage = it.product.images[0];
      }

      return {
        ...it,
        image: (await resolveImageUrl(itemImage)) || null,
      };
    })
  );
}

    return res.status(200).json({
      success: true,
      message: `Order status successfully transitioned from "${currentStatus}" to "${targetStatus}".`,
      order: {
        ...normalized,
        customerName:
          freshOrder?.shippingAddress?.fullName || freshOrder?.user?.name || "Private Patron",
        customerEmail: freshOrder?.user?.email || "N/A",
        customerPhone: freshOrder?.shippingAddress?.phone || freshOrder?.user?.phone || "N/A",
        allowedNextStatuses,
        isFulfillmentBlocked: paymentBlock.blocked,
        paymentBlockReason: paymentBlock.reason,
      },
    });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update order status.",
    });
  }
};

// ========================================================
// 4. UPDATE SHIPMENT TRACKING DETAILS
// ========================================================
export const updateOrderTracking = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { courierProvider, trackingNumber, trackingUrl, estimatedDeliveryAt, note = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order identifier format.",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    // Block registering or updating shipment tracking if payment is failed or unverified online
    const paymentBlock = getPaymentFulfillmentBlock(order);
    if (paymentBlock.blocked) {
      return res.status(400).json({
        success: false,
        message: `Cannot register or update shipment tracking: ${paymentBlock.reason}`,
      });
    }

    if (!order.trackingInfo) {
      order.trackingInfo = {};
    }

    if (courierProvider !== undefined) {
      order.trackingInfo.courierProvider = String(courierProvider).trim();
    }
    if (trackingNumber !== undefined) {
      order.trackingInfo.trackingNumber = String(trackingNumber).trim();
    }
    if (trackingUrl !== undefined) {
      order.trackingInfo.trackingUrl = String(trackingUrl).trim();
    }
    if (estimatedDeliveryAt) {
      order.trackingInfo.estimatedDeliveryAt = new Date(estimatedDeliveryAt);
    }
    if (!order.trackingInfo.dispatchedAt) {
      order.trackingInfo.dispatchedAt = new Date();
    }

    // Add status history entry for tracking update
    if (!Array.isArray(order.statusHistory)) {
      order.statusHistory = [];
    }

    order.statusHistory.push({
      previousStatus: order.orderStatus,
      newStatus: order.orderStatus,
      changedBy: req.user?._id || req.admin?._id || null,
      adminEmail: req.user?.email || req.admin?.email || "Admin",
      timestamp: new Date(),
      note: note.trim() || `Tracking updated: ${order.trackingInfo.courierProvider || "Carrier"} #${order.trackingInfo.trackingNumber || "N/A"}`,
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Shipment tracking details saved successfully.",
      order: normalizeOrderWithAllocations(order.toObject ? order.toObject() : order),
    });
  } catch (error) {
    console.error("Update tracking error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update tracking information.",
    });
  }
};

// ========================================================
// 5. UPDATE PAYMENT STATUS (e.g. COD Reconciliation)
// ========================================================
export const updatePaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus, note = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order identifier format." });
    }

    const validStatuses = ["Pending", "Paid", "Failed"];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Allowed: ${validStatuses.join(", ")}.`,
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Manual payment reconciliation is strictly for Cash on Delivery (COD) collection reconciliation
    if (order.paymentMethod !== "COD") {
      return res.status(400).json({
        success: false,
        message: "Manual payment status update is not permitted for online payments. Online payments must be verified via gateway signature verification or official webhook.",
      });
    }

    const prevPayment = order.paymentStatus;
    order.paymentStatus = paymentStatus;

    if (!Array.isArray(order.statusHistory)) {
      order.statusHistory = [];
    }

    order.statusHistory.push({
      previousStatus: order.orderStatus,
      newStatus: order.orderStatus,
      changedBy: req.user?._id || req.admin?._id || null,
      adminEmail: req.user?.email || req.admin?.email || "Admin",
      timestamp: new Date(),
      note: note.trim() || `Payment status updated from "${prevPayment}" to "${paymentStatus}".`,
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: `Payment status successfully updated to "${paymentStatus}".`,
      order: normalizeOrderWithAllocations(order.toObject ? order.toObject() : order),
    });
  } catch (error) {
    console.error("Update payment status error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update payment status.",
    });
  }
};

export default {
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  updateOrderTracking,
  updatePaymentStatus,
  ALLOWED_STATUS_TRANSITIONS,
};
