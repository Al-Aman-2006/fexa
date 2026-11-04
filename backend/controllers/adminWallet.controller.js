import mongoose from "mongoose";
import Wallet from "../models/wallet.model.js";
import User from "../models/user.model.js";
import Order from "../models/order.model.js";
import { roundToPaise } from "../utils/couponAllocation.js";

// Helper: Canonical type normalization
const normalizeType = (t) => {
  const s = String(t || "").trim().toUpperCase().replace(/[- ]/g, "_");
  if (s === "TOPUP" || s === "TOP_UP") return "Top-up";
  if (s === "REFUND" || s === "RETURN_REFUND") return "Return Refund";
  if (s === "PURCHASE" || s === "PURCHASE_DEBIT" || s === "DEBIT") return "Purchase Debit";
  if (s === "CANCELLATION" || s === "CANCELLATION_REFUND") return "Cancellation Refund";
  if (s === "ADMIN_ADJUSTMENT" || s === "ADJUSTMENT") return "Admin Adjustment";
  return t;
};

// Helper: Canonical status normalization
const normalizeStatus = (s) => {
  const stat = String(s || "").trim().toUpperCase();
  if (stat === "SUCCESS" || stat === "COMPLETED" || stat === "SUCCESSFUL") return "Completed";
  if (stat === "PENDING") return "Pending";
  if (stat === "FAILED") return "Failed";
  return s;
};

// ========================================================
// 1. GET ALL WALLET TRANSACTIONS & SUMMARY STATS FOR ADMIN
// ========================================================
export const getAdminWalletRefunds = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      type = "All",
      status = "All",
      startDate = "",
      endDate = "",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));

    // Base match criteria for transactions
    const matchConditions = {};

    // Filter by type
    if (type && type !== "All") {
      const canonicalType = normalizeType(type);
      matchConditions["transactions.type"] = canonicalType;
    }

    // Filter by status
    if (status && status !== "All") {
      const canonicalStatus = normalizeStatus(status);
      if (canonicalStatus === "Completed") {
        matchConditions["transactions.status"] = {
          $in: ["Completed", "COMPLETED", "SUCCESS", "Success", "Successful"],
        };
      } else if (canonicalStatus === "Pending") {
        matchConditions["transactions.status"] = { $in: ["Pending", "PENDING"] };
      } else if (canonicalStatus === "Failed") {
        matchConditions["transactions.status"] = { $in: ["Failed", "FAILED"] };
      } else {
        matchConditions["transactions.status"] = canonicalStatus;
      }
    }

    // Date range filtering
    if (startDate || endDate) {
      matchConditions["transactions.createdAt"] = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        matchConditions["transactions.createdAt"].$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchConditions["transactions.createdAt"].$lte = end;
      }
    }

    // Aggregation pipeline to unwind, populate, filter, and paginate
    const pipeline = [
      { $unwind: "$transactions" },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "customer",
        },
      },
      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "transactions.orderId",
          foreignField: "_id",
          as: "orderDoc",
        },
      },
      {
        $unwind: {
          path: "$orderDoc",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Search query matching multiple fields
    const trimmedSearch = String(search || "").trim();
    if (trimmedSearch) {
      const searchRegex = new RegExp(trimmedSearch, "i");
      pipeline.push({
        $match: {
          $or: [
            { "transactions.transactionId": searchRegex },
            { "transactions.description": searchRegex },
            { "transactions.referenceId": searchRegex },
            { "transactions.productName": searchRegex },
            { "customer.name": searchRegex },
            { "customer.email": searchRegex },
            { "orderDoc.orderNumber": searchRegex },
          ],
        },
      });
    }

    // Facet for pagination and total count
    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $sort: { "transactions.createdAt": -1 } },
          { $skip: (pageNum - 1) * limitNum },
          { $limit: limitNum },
          {
            $project: {
              _id: "$transactions._id",
              transactionId: "$transactions.transactionId",
              type: "$transactions.type",
              amount: "$transactions.amount",
              direction: "$transactions.direction",
              description: "$transactions.description",
              referenceId: "$transactions.referenceId",
              orderId: "$transactions.orderId",
              orderNumber: { $ifNull: ["$orderDoc.orderNumber", "$transactions.referenceId"] },
              productId: "$transactions.productId",
              productName: "$transactions.productName",
              itemPrice: "$transactions.itemPrice",
              itemOfferDiscount: "$transactions.itemOfferDiscount",
              itemCouponDiscount: "$transactions.itemCouponDiscount",
              itemQuantity: "$transactions.itemQuantity",
              refundReason: "$transactions.refundReason",
              balanceBefore: "$transactions.balanceBefore",
              balanceAfter: "$transactions.balanceAfter",
              status: "$transactions.status",
              createdAt: "$transactions.createdAt",
              customer: {
                _id: "$customer._id",
                name: { $ifNull: ["$customer.name", "FEXA Patron"] },
                email: { $ifNull: ["$customer.email", "N/A"] },
                phone: "$customer.phone",
              },
            },
          },
        ],
      },
    });

    const result = await Wallet.aggregate(pipeline);

    const total = result[0]?.metadata[0]?.total || 0;
    const transactions = result[0]?.data || [];
    const totalPages = Math.ceil(total / limitNum) || 1;

    // Calculate Summary Statistics for Wallet Refunds directly from MongoDB
    const refundStatsPipeline = [
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": {
            $in: [
              "Cancellation Refund",
              "Return Refund",
              "CANCELLATION",
              "CANCELLATION_REFUND",
              "REFUND",
              "RETURN_REFUND",
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalRefunds: { $sum: 1 },
          totalRefundAmount: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$transactions.status",
                    ["Completed", "COMPLETED", "SUCCESS", "Success", "Successful"],
                  ],
                },
                "$transactions.amount",
                0,
              ],
            },
          },
          successfulRefunds: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$transactions.status",
                    ["Completed", "COMPLETED", "SUCCESS", "Success", "Successful"],
                  ],
                },
                1,
                0,
              ],
            },
          },
          pendingRefunds: {
            $sum: {
              $cond: [
                { $in: ["$transactions.status", ["Pending", "PENDING"]] },
                1,
                0,
              ],
            },
          },
          failedRefunds: {
            $sum: {
              $cond: [
                { $in: ["$transactions.status", ["Failed", "FAILED"]] },
                1,
                0,
              ],
            },
          },
        },
      },
    ];

    const statsResult = await Wallet.aggregate(refundStatsPipeline);
    const statsData = statsResult[0] || {
      totalRefunds: 0,
      totalRefundAmount: 0,
      successfulRefunds: 0,
      pendingRefunds: 0,
      failedRefunds: 0,
    };

    return res.status(200).json({
      success: true,
      stats: {
        totalRefunds: statsData.totalRefunds || 0,
        totalRefundAmount: roundToPaise(statsData.totalRefundAmount || 0),
        successfulRefunds: statsData.successfulRefunds || 0,
        pendingRefunds: statsData.pendingRefunds || 0,
        failedRefunds: statsData.failedRefunds || 0,
      },
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Get admin wallet refunds error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve wallet transactions.",
    });
  }
};

// ========================================================
// 2. GET SINGLE WALLET TRANSACTION INSPECTION DETAILS
// ========================================================
export const getAdminWalletTransactionById = async (req, res) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: "Transaction identifier is required.",
      });
    }

    // Find the wallet containing this transaction
    const wallet = await Wallet.findOne({
      "transactions.transactionId": transactionId,
    }).populate("user", "name email phone");

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet transaction record not found.",
      });
    }

    const tx = wallet.transactions.find((t) => t.transactionId === transactionId);
    if (!tx) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found in customer wallet.",
      });
    }

    // Fetch related order if available
    let orderDetails = null;
    let orderItemDetails = null;
    if (tx.orderId) {
      const order = await Order.findById(tx.orderId).lean();
      if (order) {
        orderDetails = {
          _id: order._id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          totalAmount: order.totalAmount,
        };

        if (tx.productId) {
          const item = (order.items || []).find(
            (it) => it.product && it.product.toString() === tx.productId.toString()
          );
          if (item) {
            orderItemDetails = item;
          }
        }
      }
    }

    // Reconstruct / read authoritative financial breakdown
    const originalPrice =
      tx.itemPrice ||
      (orderItemDetails ? orderItemDetails.originalPrice || orderItemDetails.unitPrice : 0) ||
      0;
    const quantity = tx.itemQuantity || (orderItemDetails ? orderItemDetails.quantity : 1) || 1;
    const offerDiscount =
      tx.itemOfferDiscount ||
      (orderItemDetails && orderItemDetails.originalPrice
        ? Math.max(0, orderItemDetails.originalPrice - orderItemDetails.unitPrice) * quantity
        : 0) ||
      0;
    const couponDiscount =
      tx.itemCouponDiscount ||
      (orderItemDetails ? orderItemDetails.allocatedCouponDiscount : 0) ||
      0;

    const detailedRecord = {
      transactionId: tx.transactionId,
      type: tx.type,
      direction: tx.direction,
      amount: roundToPaise(tx.amount),
      status: tx.status,
      description: tx.description,
      referenceId: tx.referenceId,
      balanceBefore: roundToPaise(tx.balanceBefore),
      balanceAfter: roundToPaise(tx.balanceAfter),
      createdAt: tx.createdAt,
      customer: {
        _id: wallet.user?._id || null,
        name: wallet.user?.name || "FEXA Patron",
        email: wallet.user?.email || "N/A",
        phone: wallet.user?.phone || "N/A",
      },
      order: orderDetails,
      item: {
        productId: tx.productId || orderItemDetails?.product || null,
        name: tx.productName || orderItemDetails?.name || "Fragrance Item",
        quantity,
        originalPrice: roundToPaise(originalPrice),
        offerDiscount: roundToPaise(offerDiscount),
        couponDiscount: roundToPaise(couponDiscount),
        refundableAmount: roundToPaise(tx.amount),
        refundReason: tx.refundReason || orderItemDetails?.cancellationReason || "Patron Requested",
      },
    };

    return res.status(200).json({
      success: true,
      transaction: detailedRecord,
    });
  } catch (error) {
    console.error("Get admin wallet transaction details error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to inspect wallet transaction.",
    });
  }
};

export default {
  getAdminWalletRefunds,
  getAdminWalletTransactionById,
};

