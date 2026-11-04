import mongoose from "mongoose";
import Order from "../models/order.model.js";
import ReturnRequest, { RETURN_REASONS } from "../models/returnRequest.model.js";
import {
  calculateItemRefund,
  normalizeOrderWithAllocations,
  roundToPaise,
} from "../utils/couponAllocation.js";

// ========================================================
// 1. GET ALL ITEMS ELIGIBLE FOR RETURN FOR AUTHENTICATED USER
// ========================================================
export const getEligibleReturnItems = async (req, res) => {
  try {
    const userId = req.user.id;

    // Only orders that have been successfully delivered are eligible for returns
    const deliveredOrders = await Order.find({
      user: userId,
      orderStatus: "Delivered",
    })
      .sort({ createdAt: -1 })
      .lean();

    const eligibleItems = [];

    for (const order of deliveredOrders) {
      const normalizedOrder = normalizeOrderWithAllocations(order);

      for (const item of normalizedOrder.items) {
        const purchasedQty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const alreadyReturnedQty = Math.max(0, parseInt(item.returnedQuantity, 10) || 0);
        const isPendingReview = item.itemStatus === "Return Requested";
        const pendingQty = isPendingReview
          ? Math.max(0, parseInt(item.requestedReturnQuantity, 10) || 1)
          : 0;

        const availableQty = Math.max(0, purchasedQty - alreadyReturnedQty - pendingQty);

        if (availableQty > 0) {
          // Calculate refund base for 1 unit based on historical paid amount
          let unitRefundBase = item.discountedUnitAmount;
          try {
            const refundCalc = calculateItemRefund(item, 1);
            unitRefundBase = refundCalc.refundAmount;
          } catch {
            unitRefundBase = item.discountedUnitAmount || item.unitPrice;
          }

          eligibleItems.push({
            orderId: order._id,
            orderNumber: order.orderNumber,
            orderDate: order.createdAt,
            orderPaymentMethod: order.paymentMethod,
            itemId: item._id,
            productId: item.product,
            productName: item.name,
            brand: item.brand || "FEXA",
            variantId: item.variantId,
            variantVolume: item.volumeMl ? `${item.volumeMl}ml` : "100ml",
            volumeMl: item.volumeMl || 100,
            image: item.image || null,
            purchasedQuantity: purchasedQty,
            returnedQuantity: alreadyReturnedQty,
            pendingReturnQuantity: pendingQty,
            availableQuantity: availableQty,
            unitPrice: roundToPaise(item.unitPrice),
            perUnitOfferDiscount: roundToPaise(item.offerDiscount || 0),
            perUnitCouponDiscount: roundToPaise(item.perUnitDiscount || 0),
            discountedUnitAmount: roundToPaise(item.discountedUnitAmount || item.unitPrice),
            estimatedUnitRefund: roundToPaise(unitRefundBase),
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      count: eligibleItems.length,
      items: eligibleItems,
    });
  } catch (error) {
    console.error("Get eligible return items error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve eligible return items.",
    });
  }
};

// ========================================================
// 2. SUBMIT A RETURN REQUEST (CUSTOMER SIDE)
// ========================================================
export const createReturnRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      orderId,
      itemId,
      returnReason,
      customerNotes = "",
      quantity = 1,
      evidenceImages = [],
    } = req.body;

    if (!orderId || !itemId) {
      return res.status(400).json({
        success: false,
        message: "Order ID and Item ID are required to initiate a return.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order or item identifier.",
      });
    }

    // Verify order ownership & delivered status
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found in your account history.",
      });
    }

    if (order.orderStatus !== "Delivered") {
      return res.status(400).json({
        success: false,
        message: "Returns can only be requested for orders that have been successfully delivered.",
      });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Fragrance item not found in this order.",
      });
    }

    // Check if an active return request is already pending
    if (item.itemStatus === "Return Requested") {
      return res.status(400).json({
        success: false,
        message: "A return request is already under review for this fragrance.",
      });
    }

    // Validate return reason
    if (!returnReason || !RETURN_REASONS.includes(returnReason)) {
      return res.status(400).json({
        success: false,
        message: `Please select a valid return reason from the permitted options.`,
        allowedReasons: RETURN_REASONS,
      });
    }

    if (returnReason === "Other" && (!customerNotes || customerNotes.trim().length < 5)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a detailed explanation when selecting 'Other' as the return reason.",
      });
    }

    // Validate return quantity
    const reqQty = parseInt(quantity, 10);
    const purchasedQty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const alreadyReturnedQty = Math.max(0, parseInt(item.returnedQuantity, 10) || 0);
    const availableQty = Math.max(0, purchasedQty - alreadyReturnedQty);

    if (isNaN(reqQty) || reqQty < 1 || reqQty > availableQty) {
      return res.status(400).json({
        success: false,
        message: `Invalid return quantity. You can return between 1 and ${availableQty} unit(s).`,
      });
    }

    // Ensure item has stored allocations (reconstructed safely from historical snapshot if needed)
    const normalizedOrder = normalizeOrderWithAllocations(order.toObject ? order.toObject() : order);
    const normalizedItem = normalizedOrder.items.find((it) => it._id.toString() === itemId.toString());

    // Calculate exact authoritative refund based on historical paid amount
    const refundCalc = calculateItemRefund(normalizedItem, reqQty);
    const eligibleRefundAmount = refundCalc.refundAmount;

    // Create ReturnRequest document
    const returnRequest = new ReturnRequest({
      user: userId,
      order: order._id,
      orderNumber: order.orderNumber,
      item: {
        orderItemId: item._id,
        productId: item.product,
        productName: item.name,
        variantId: item.variantId,
        variantVolume: item.volumeMl ? `${item.volumeMl}ml` : "100ml",
        volumeMl: item.volumeMl || 100,
        purchasedQuantity: item.quantity,
        requestedQuantity: reqQty,
        unitPrice: roundToPaise(item.unitPrice),
        perUnitOfferDiscount: roundToPaise(item.offerDiscount || 0),
        perUnitCouponDiscount: roundToPaise(normalizedItem.perUnitDiscount || 0),
        discountedUnitAmount: roundToPaise(normalizedItem.discountedUnitAmount),
        image: item.image || null,
      },
      returnReason,
      customerNotes: String(customerNotes || "").trim(),
      evidenceImages: Array.isArray(evidenceImages) ? evidenceImages.slice(0, 5) : [],
      status: "Requested",
      eligibleRefundAmount,
      statusHistory: [
        {
          status: "Requested",
          changedBy: userId,
          note: `Customer submitted return request for ${reqQty} unit(s). Reason: ${returnReason}`,
          timestamp: new Date(),
        },
      ],
    });

    await returnRequest.save();

    // Mark order item as "Return Requested"
    item.itemStatus = "Return Requested";
    item.requestedReturnQuantity = reqQty;
    item.returnReason = returnReason;
    item.returnRequestedAt = new Date();
    item.refundStatus = "Pending";

    // Store allocation snapshot on order item if not present
    if (!item.allocatedCouponDiscount && normalizedItem.allocatedCouponDiscount) {
      item.allocatedCouponDiscount = normalizedItem.allocatedCouponDiscount;
      item.discountedLineAmount = normalizedItem.discountedLineAmount;
      item.perUnitDiscount = normalizedItem.perUnitDiscount;
      item.discountedUnitAmount = normalizedItem.discountedUnitAmount;
    }

    await order.save();

    return res.status(201).json({
      success: true,
      message: `Return request #${returnRequest.requestNumber} submitted successfully.`,
      returnRequest,
    });
  } catch (error) {
    console.error("Create return request error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit return request.",
    });
  }
};

// ========================================================
// 3. GET CUSTOMER'S RETURN REQUESTS LIST
// ========================================================
export const getCustomerReturns = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status = "All" } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const query = { user: userId };
    if (status && status !== "All") {
      query.status = status;
    }

    const [requests, totalCount] = await Promise.all([
      ReturnRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ReturnRequest.countDocuments(query),
    ]);

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
    });
  } catch (error) {
    console.error("Get customer returns error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve return requests.",
    });
  }
};

// ========================================================
// 4. GET SINGLE RETURN REQUEST DETAILS FOR CUSTOMER
// ========================================================
export const getCustomerReturnById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid return request identifier." });
    }

    const request = await ReturnRequest.findOne({ _id: id, user: userId })
      .populate("order", "orderNumber paymentMethod paymentStatus orderStatus createdAt")
      .lean();

    if (!request) {
      return res.status(404).json({ success: false, message: "Return request not found." });
    }

    return res.status(200).json({
      success: true,
      returnRequest: request,
    });
  } catch (error) {
    console.error("Get customer return details error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve return request details.",
    });
  }
};

export default {
  getEligibleReturnItems,
  createReturnRequest,
  getCustomerReturns,
  getCustomerReturnById,
};
