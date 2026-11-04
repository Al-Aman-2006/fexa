import mongoose from "mongoose";
import ReturnRequest from "../models/returnRequest.model.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import Wallet from "../models/wallet.model.js";
import { getOrCreateUserWallet } from "./wallet.controller.js";
import {
  calculateItemRefund,
  normalizeOrderWithAllocations,
  roundToPaise,
} from "../utils/couponAllocation.js";

// ========================================================
// 1. GET ALL RETURN REQUESTS FOR ADMIN WITH FILTERS & STATS
// ========================================================
export const getAdminReturns = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "All",
      startDate = "",
      endDate = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    // 1. Status Filter
    if (status && status !== "All") {
      filter.status = status;
    }

    // 2. Date Range Filter
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

    // 3. Search Filter (requestNumber, orderNumber, product name, customer name/email)
    const trimmedSearch = search ? String(search).trim() : "";
    if (trimmedSearch) {
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: trimmedSearch, $options: "i" } },
          { email: { $regex: trimmedSearch, $options: "i" } },
          { phone: { $regex: trimmedSearch, $options: "i" } },
        ],
      }).select("_id");

      const userIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { requestNumber: { $regex: trimmedSearch, $options: "i" } },
        { orderNumber: { $regex: trimmedSearch, $options: "i" } },
        { "item.productName": { $regex: trimmedSearch, $options: "i" } },
        { user: { $in: userIds } },
      ];
    }

    // Sort order
    const sort = {};
    const validSortFields = ["createdAt", "eligibleRefundAmount", "status", "requestNumber"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    sort[sortField] = sortOrder === "asc" ? 1 : -1;

    const [requests, totalCount, statsResult] = await Promise.all([
      ReturnRequest.find(filter)
        .populate("user", "name email phone")
        .populate("order", "orderNumber paymentMethod paymentStatus orderStatus createdAt")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ReturnRequest.countDocuments(filter),
      ReturnRequest.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalRefunded: {
              $sum: {
                $cond: [{ $eq: ["$status", "Refunded"] }, "$actualRefundAmount", 0],
              },
            },
          },
        },
      ]),
    ]);

    // Parse aggregated stats
    let totalAll = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let refundedCount = 0;
    let totalRefundedDisbursed = 0;

    statsResult.forEach((stat) => {
      totalAll += stat.count;
      if (stat._id === "Requested" || stat._id === "Under Review" || stat._id === "Refund Processing") {
        pendingCount += stat.count;
      } else if (stat._id === "Approved") {
        approvedCount += stat.count;
      } else if (stat._id === "Rejected") {
        rejectedCount += stat.count;
      } else if (stat._id === "Refunded") {
        refundedCount += stat.count;
        totalRefundedDisbursed += stat.totalRefunded || 0;
      }
    });

    const stats = {
      totalRequests: totalAll,
      pendingRequests: pendingCount,
      approvedRequests: approvedCount,
      rejectedRequests: rejectedCount,
      refundedRequests: refundedCount,
      totalRefundedAmount: roundToPaise(totalRefundedDisbursed),
    };

    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    return res.status(200).json({
      success: true,
      returns: requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      stats,
    });
  } catch (error) {
    console.error("Get admin returns error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve return requests.",
    });
  }
};

// ========================================================
// 2. GET SINGLE RETURN REQUEST DETAILS FOR ADMIN
// ========================================================
export const getAdminReturnById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid return request identifier." });
    }

    const request = await ReturnRequest.findById(id)
      .populate("user", "name email phone")
      .populate("order")
      .lean();

    if (!request) {
      return res.status(404).json({ success: false, message: "Return request not found." });
    }

    // Retrieve order item details with stored allocations
    let orderItem = null;
    if (request.order && Array.isArray(request.order.items)) {
      const normalizedOrder = normalizeOrderWithAllocations(request.order);
      orderItem = normalizedOrder.items.find(
        (it) => it._id.toString() === request.item.orderItemId.toString()
      );
    }

    // If wallet transaction is attached, fetch it
    let walletTx = null;
    if (request.walletTransactionId) {
      const wallet = await Wallet.findOne({ user: request.user._id }).lean();
      if (wallet && wallet.transactions) {
        walletTx = wallet.transactions.find(
          (tx) => tx.transactionId === request.walletTransactionId
        );
      }
    }

    return res.status(200).json({
      success: true,
      returnRequest: {
        ...request,
        orderItemSnapshot: orderItem || request.item,
        walletTransaction: walletTx || null,
      },
    });
  } catch (error) {
    console.error("Get admin return details error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve return details.",
    });
  }
};

// ========================================================
// Helper: Check if active MongoDB deployment supports transactions
const deploymentSupportsTransactions = () => {
  const type = mongoose.connection.client?.topology?.description?.type || "";
  return type.includes("ReplicaSet") || type.includes("Sharded");
};

// ========================================================
// 3. APPROVE RETURN REQUEST & DISBURSE WALLET REFUND (IDEMPOTENT & ATOMIC)
// ========================================================
export const approveReturnRequest = async (req, res) => {
  let session = null;
  const useTransaction = deploymentSupportsTransactions();

  try {
    if (useTransaction) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    const { id } = req.params;
    const { adminNotes = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(400).json({ success: false, message: "Invalid return request identifier." });
    }

    const returnRequestQuery = ReturnRequest.findById(id);
    if (session) returnRequestQuery.session(session);
    const returnRequest = await returnRequestQuery;

    if (!returnRequest) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({ success: false, message: "Return request not found." });
    }

    // IDEMPOTENCY CHECK: If already refunded, return existing state safely
    if (returnRequest.status === "Refunded") {
      const userWalletQuery = Wallet.findOne({ user: returnRequest.user });
      if (session) userWalletQuery.session(session);
      const userWallet = await userWalletQuery;

      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(200).json({
        success: true,
        message: `This return request has already been approved and ₹${returnRequest.actualRefundAmount} was credited to the customer's wallet.`,
        returnRequest,
        walletBalance: userWallet ? roundToPaise(userWallet.balance) : 0,
      });
    }

    if (returnRequest.status === "Rejected") {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(400).json({
        success: false,
        message: "Cannot approve a previously rejected return request.",
      });
    }

    // Load corresponding order
    const orderQuery = Order.findById(returnRequest.order);
    if (session) orderQuery.session(session);
    const order = await orderQuery;

    if (!order) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({ success: false, message: "Associated order not found." });
    }

    const item = order.items.id(returnRequest.item.orderItemId);
    if (!item) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({ success: false, message: "Item not found in the original order." });
    }

    const requestedQty = returnRequest.item.requestedQuantity || 1;
    const availableQty = (item.quantity || 1) - (item.returnedQuantity || 0);

    if (requestedQty > availableQty) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(400).json({
        success: false,
        message: `Cannot approve return: requested quantity (${requestedQty}) exceeds remaining eligible units (${availableQty}).`,
      });
    }

    // Authoritative Historical Refund Calculation
    const normalizedOrder = normalizeOrderWithAllocations(order.toObject ? order.toObject() : order);
    const normalizedItem = normalizedOrder.items.find(
      (it) => it._id.toString() === item._id.toString()
    );

    const refundCalc = calculateItemRefund(normalizedItem, requestedQty);
    const refundAmount = refundCalc.refundAmount;

    if (refundAmount <= 0) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(400).json({
        success: false,
        message: "Calculated refund amount must be greater than zero.",
      });
    }

    // 1. Credit Customer's FEXA Wallet (Idempotent)
    const wallet = await getOrCreateUserWallet(returnRequest.user, session);

    // Double check that this return request hasn't already been credited in wallet
    const existingTx = wallet.transactions.find(
      (tx) => tx.returnRequestId && tx.returnRequestId.toString() === returnRequest._id.toString()
    );

    let transactionRecord = existingTx;

    if (!existingTx) {
      const balanceBefore = roundToPaise(wallet.balance);
      const balanceAfter = roundToPaise(balanceBefore + refundAmount);
      const txId = `TXN-RFND-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      transactionRecord = {
        transactionId: txId,
        type: "Return Refund",
        amount: refundAmount,
        direction: "Credit",
        description: `Refund for return #${returnRequest.requestNumber} (${returnRequest.item.productName})`,
        referenceId: returnRequest.requestNumber,
        orderId: order._id,
        returnRequestId: returnRequest._id,
        balanceBefore,
        balanceAfter,
        status: "Completed",
        createdAt: new Date(),
      };

      wallet.balance = balanceAfter;
      wallet.transactions.push(transactionRecord);
      await wallet.save(session ? { session } : {});
    }

    // 2. Restock Perfume Variant Inventory in MongoDB
    if (returnRequest.item.productId && returnRequest.item.variantId) {
      await Product.updateOne(
        {
          _id: returnRequest.item.productId,
          "variants._id": returnRequest.item.variantId,
        },
        {
          $inc: {
            "variants.$.stock": requestedQty,
            stock: requestedQty,
          },
        },
        session ? { session } : {}
      );

      // Ensure product status is Active if previously Out of Stock
      const prodQuery = Product.findById(returnRequest.item.productId);
      if (session) prodQuery.session(session);
      const prod = await prodQuery;

      if (prod && prod.stock > 0 && prod.status === "Out of Stock") {
        prod.status = "Active";
        await prod.save(session ? { session } : {});
      }
    }

    // 3. Update ReturnRequest Status
    const adminId = req.admin?._id || req.user?.id || null;
    const adminEmail = req.admin?.email || req.user?.email || "Admin";

    returnRequest.status = "Refunded";
    returnRequest.actualRefundAmount = refundAmount;
    returnRequest.adminNotes = String(adminNotes || "").trim();
    returnRequest.decisionDate = new Date();
    returnRequest.refundedAt = new Date();
    returnRequest.walletTransactionId = transactionRecord.transactionId;

    returnRequest.statusHistory.push({
      status: "Refunded",
      changedBy: adminId,
      adminEmail,
      note: `Return approved and refund of ₹${refundAmount.toLocaleString("en-IN")} credited to customer wallet.`,
      timestamp: new Date(),
    });

    await returnRequest.save(session ? { session } : {});

    // 4. Update Order Item Status and Totals
    item.allocatedCouponDiscount = normalizedItem.allocatedCouponDiscount;
    item.discountedLineAmount = normalizedItem.discountedLineAmount;
    item.perUnitDiscount = normalizedItem.perUnitDiscount;
    item.discountedUnitAmount = normalizedItem.discountedUnitAmount;

    item.returnedQuantity = (item.returnedQuantity || 0) + requestedQty;
    item.refundAmount = roundToPaise((item.refundAmount || 0) + refundAmount);
    item.itemStatus = item.returnedQuantity >= item.quantity ? "Returned" : "Partially Returned";
    item.refundStatus = "Refunded";
    item.refundedAt = new Date();
    item.refundTransactionId = transactionRecord.transactionId;
    item.requestedReturnQuantity = 0;

    order.totalRefundedAmount = roundToPaise((order.totalRefundedAmount || 0) + refundAmount);
    order.hasReturns = true;

    if (!Array.isArray(order.statusHistory)) {
      order.statusHistory = [];
    }

    order.statusHistory.push({
      previousStatus: order.orderStatus,
      newStatus: order.orderStatus,
      changedBy: adminId,
      adminEmail,
      timestamp: new Date(),
      note: `Return approved for "${item.name}" (${requestedQty} unit(s)). ₹${refundAmount.toLocaleString("en-IN")} credited to wallet.`,
    });

    await order.save(session ? { session } : {});

    // If transaction session was active, commit
    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    return res.status(200).json({
      success: true,
      message: `Return approved successfully. ₹${refundAmount.toLocaleString("en-IN")} credited to patron's wallet.`,
      returnRequest,
      refundAmount,
      walletBalance: roundToPaise(wallet.balance),
      transaction: transactionRecord,
    });
  } catch (error) {
    console.error("Approve return request error:", error);
    if (session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        session.endSession();
      } catch (sErr) {
        console.warn("Session clean up warning:", sErr.message);
      }
    }

    if (error.name === "ValidationError") {
      const errorMsgs = Object.values(error.errors || {})
        .map((e) => e.message)
        .join("; ");
      return res.status(400).json({
        success: false,
        message: `Validation Error: ${errorMsgs || error.message}`,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process return approval.",
    });
  }
};

// ========================================================
// 4. REJECT RETURN REQUEST (REQUIRES REASON)
// ========================================================
export const rejectReturnRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason, adminNotes = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid return request identifier." });
    }

    const cleanReason = String(rejectionReason || "").trim();
    if (!cleanReason || cleanReason.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid and meaningful rejection reason.",
      });
    }

    const returnRequest = await ReturnRequest.findById(id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Return request not found." });
    }

    // Cannot reject if already refunded
    if (returnRequest.status === "Refunded") {
      return res.status(400).json({
        success: false,
        message: "Cannot reject a return request that has already been approved and refunded.",
      });
    }

    // Idempotency check: If already rejected, return current state
    if (returnRequest.status === "Rejected") {
      return res.status(200).json({
        success: true,
        message: "This return request is already marked as rejected.",
        returnRequest,
      });
    }

    const adminId = req.admin?._id || req.user?.id || null;
    const adminEmail = req.admin?.email || req.user?.email || "Admin";

    returnRequest.status = "Rejected";
    returnRequest.rejectionReason = cleanReason;
    returnRequest.adminNotes = String(adminNotes || "").trim();
    returnRequest.decisionDate = new Date();

    returnRequest.statusHistory.push({
      status: "Rejected",
      changedBy: adminId,
      adminEmail,
      note: `Return rejected by admin. Reason: ${cleanReason}`,
      timestamp: new Date(),
    });

    await returnRequest.save();

    // Update corresponding order item status
    const order = await Order.findById(returnRequest.order);
    if (order) {
      const item = order.items.id(returnRequest.item.orderItemId);
      if (item) {
        item.itemStatus = (item.returnedQuantity || 0) > 0 ? "Partially Returned" : "Active";
        item.refundStatus = "Rejected";
        item.returnReason = cleanReason;
        item.requestedReturnQuantity = 0;
        await order.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: `Return request #${returnRequest.requestNumber} rejected.`,
      returnRequest,
    });
  } catch (error) {
    console.error("Reject return request error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process return rejection.",
    });
  }
};

export default {
  getAdminReturns,
  getAdminReturnById,
  approveReturnRequest,
  rejectReturnRequest,
};
