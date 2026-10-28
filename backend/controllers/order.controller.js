import crypto from "crypto";
import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import User from "../models/user.model.js";
import Coupon from "../models/coupon.model.js";
import { getRazorpayInstance } from "../config/razorpay.js";
import {
  calculateItemCouponAllocations,
  calculateItemRefund,
  normalizeOrderWithAllocations,
  roundToPaise,
} from "../utils/couponAllocation.js";
import { getActiveValidOffers, findBestOfferForProduct } from "../utils/offerCalculator.js";

// ========================================================
// HELPER: Validate and calculate single coupon for order
// ========================================================
const resolveOrderCoupon = async (couponCode, subtotal, userId) => {
  if (!couponCode || typeof couponCode !== "string" || !couponCode.trim()) {
    return { coupon: null, discountAmount: 0 };
  }

  const normalized = couponCode.trim().toUpperCase();
  const coupon = await Coupon.findOne({ code: normalized, isArchived: false });
  if (!coupon) {
    return { error: `Coupon "${normalized}" is invalid or does not exist.` };
  }

  const check = coupon.validateForOrder(subtotal, userId);
  if (!check.valid) {
    return { error: check.reason };
  }

  const discountAmount = coupon.calculateDiscount(subtotal);
  return { coupon, discountAmount };
};

// ========================================================
// CREATE ORDER (With Re-validation & Atomic Variant Stock Deduction)
// ========================================================
const createOrder = async (req, res) => {
  const deductedItems = []; // Tracking for rollback in case of concurrency failure

  try {
    const userId = req.user.id;
    const { addressId, shippingAddressId, paymentMethod = "COD", couponCode } = req.body;

    // 0. Verify authenticated user and validate saved address
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    // Idempotency: If this order has already been finalized as Paid or confirmed as COD, return it immediately
    if (req.body.orderId && mongoose.Types.ObjectId.isValid(req.body.orderId)) {
      const existingFinalized = await Order.findOne({ _id: req.body.orderId, user: userId });
      if (
        existingFinalized &&
        (existingFinalized.paymentStatus === "Paid" ||
          (existingFinalized.paymentMethod === "COD" && existingFinalized.orderStatus === "Processing"))
      ) {
        return res.status(200).json({
          success: true,
          message: "Order already confirmed.",
          order: existingFinalized,
        });
      }
    }

    const targetAddressId =
      addressId ||
      shippingAddressId ||
      (req.body.shippingAddress && req.body.shippingAddress._id);

    if (!targetAddressId) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid saved delivery address from your profile.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(targetAddressId)) {
      return res.status(400).json({
        success: false,
        message: "The selected delivery address identifier is invalid.",
      });
    }

    const selectedAddress = user.addresses.id(targetAddressId);
    if (!selectedAddress) {
      return res.status(400).json({
        success: false,
        message: "The selected delivery address does not exist or does not belong to your account.",
      });
    }

    const hasStreetAddress = Boolean(
      (selectedAddress.house && selectedAddress.house.trim()) ||
      (selectedAddress.street && selectedAddress.street.trim()) ||
      (selectedAddress.addressLine && selectedAddress.addressLine.trim())
    );

    if (
      !selectedAddress.fullName ||
      !selectedAddress.fullName.trim() ||
      !selectedAddress.phone ||
      !selectedAddress.phone.trim() ||
      !selectedAddress.city ||
      !selectedAddress.city.trim() ||
      !selectedAddress.pincode ||
      !selectedAddress.pincode.trim() ||
      !hasStreetAddress
    ) {
      return res.status(400).json({
        success: false,
        message: "The selected delivery address is incomplete. Please update it in your profile before ordering.",
      });
    }

    const addressLineSnapshot =
      [selectedAddress.house, selectedAddress.street]
        .filter((part) => part && part.trim())
        .join(", ") || selectedAddress.addressLine || "";

    const shippingAddressSnapshot = {
      addressId: selectedAddress._id,
      label: selectedAddress.label || "Home",
      fullName: selectedAddress.fullName.trim(),
      phone: selectedAddress.phone.trim(),
      house: (selectedAddress.house || "").trim(),
      street: (selectedAddress.street || "").trim(),
      addressLine: addressLineSnapshot.trim(),
      city: selectedAddress.city.trim(),
      state: (selectedAddress.state || "").trim(),
      pincode: selectedAddress.pincode.trim(),
      country: selectedAddress.country || "India",
    };

    // 1. Fetch source items (from body if supplied, or from user's active cart)
    const cart = await Cart.findOne({ user: userId });
    const sourceItems =
      Array.isArray(req.body.items) && req.body.items.length > 0
        ? req.body.items
        : cart && cart.items
        ? cart.items
        : [];

    if (sourceItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your shopping bag is empty. Please add fragrances before placing an order.",
      });
    }

    const activeOffers = await getActiveValidOffers();
    const orderItems = [];
    let calculatedSubtotal = 0;
    let originalSubtotal = 0;
    let totalOfferDiscount = 0;

    // 2. Validate every item against live MongoDB product & variant records
    for (const item of sourceItems) {
      const prodId = item.productId || item.product;
      const product = await Product.findById(prodId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "One of the fragrances is no longer available.",
        });
      }

      const categoryDoc = await Category.findOne({ name: product.category });
      if (categoryDoc && !categoryDoc.isActive) {
        return res.status(400).json({
          success: false,
          message: `"${product.name}" belongs to the ${product.category} collection, which is currently unavailable for purchase.`,
        });
      }

      if (product.status === "Inactive") {
        return res.status(400).json({
          success: false,
          message: `"${product.name}" is currently unavailable.`,
        });
      }

      // Locate variant
      let variant = null;
      if (product.variants && product.variants.length > 0) {
        if (item.variantId) {
          variant = product.variants.find(
            (v) => v._id.toString() === item.variantId.toString()
          );
        } else if (product.variants.length === 1) {
          variant = product.variants[0];
        }
      }

      if (!variant) {
        return res.status(400).json({
          success: false,
          message: `Please choose a valid size variant for "${product.name}".`,
        });
      }

      if (variant.isAvailable === false) {
        return res.status(400).json({
          success: false,
          message: `The ${variant.volumeMl} ml size of "${product.name}" is currently discontinued or unavailable.`,
        });
      }

      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty < 1 || qty > 5) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for "${product.name}" (${variant.volumeMl} ml). Max 5 units allowed.`,
        });
      }

      if (qty > variant.stock) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}" (${variant.volumeMl} ml). Available stock: ${variant.stock}.`,
        });
      }

      // Live MongoDB price calculation with automatic offer discount
      const basePrice = roundToPaise(variant.sellingPrice);
      const originalPrice = basePrice;
      const bestOffer = findBestOfferForProduct(product, activeOffers, basePrice);
      const unitPrice = bestOffer.offerPrice;
      const unitOfferDiscount = bestOffer.discountAmount;
      const lineOfferDiscount = roundToPaise(unitOfferDiscount * qty);
      const lineTotal = roundToPaise(unitPrice * qty);

      calculatedSubtotal += lineTotal;
      originalSubtotal += roundToPaise(originalPrice * qty);
      totalOfferDiscount += lineOfferDiscount;

      orderItems.push({
        product: product._id,
        variantId: variant._id,
        name: product.name,
        brand: product.brand || "FEXA",
        category: product.category,
        volumeMl: variant.volumeMl,
        quantity: qty,
        unitPrice,
        originalPrice,
        appliedOffer: bestOffer.offer ? bestOffer.offer._id : null,
        offerName: bestOffer.offer ? bestOffer.offer.name : null,
        offerDiscountPercentage: bestOffer.discountPercentage || null,
        offerDiscount: unitOfferDiscount,
        offerAdjustedUnitPrice: unitPrice,
        lineTotal,
        image: product.images && product.images.length > 0 ? product.images[0] : null,
      });
    }

    // 3. Atomically deduct stock from selected variants
    for (const it of orderItems) {
      const updateResult = await Product.updateOne(
        {
          _id: it.product,
          "variants._id": it.variantId,
          "variants.stock": { $gte: it.quantity },
        },
        {
          $inc: {
            "variants.$.stock": -it.quantity,
            stock: -it.quantity,
          },
        }
      );

      if (updateResult.matchedCount === 0 || updateResult.modifiedCount === 0) {
        // Rollback already deducted items
        for (const rolled of deductedItems) {
          await Product.updateOne(
            { _id: rolled.product, "variants._id": rolled.variantId },
            {
              $inc: {
                "variants.$.stock": rolled.quantity,
                stock: rolled.quantity,
              },
            }
          );
        }

        return res.status(400).json({
          success: false,
          message: `Could not reserve stock for ${it.name} (${it.volumeMl} ml). Another customer may have just placed an order.`,
        });
      }

      deductedItems.push({
        product: it.product,
        variantId: it.variantId,
        quantity: it.quantity,
      });

      // Update product status to Out of Stock if total stock reached 0
      const updatedProd = await Product.findById(it.product);
      if (updatedProd && updatedProd.stock <= 0 && updatedProd.status === "Active") {
        updatedProd.status = "Out of Stock";
        await updatedProd.save();
      }
    }

    // 4. Resolve coupon & calculate discount
    let targetCouponCode = couponCode;
    if (!targetCouponCode && req.body.orderId && mongoose.Types.ObjectId.isValid(req.body.orderId)) {
      const prevOrder = await Order.findOne({ _id: req.body.orderId, user: userId });
      if (prevOrder && prevOrder.couponCode) {
        targetCouponCode = prevOrder.couponCode;
      }
    }

    let appliedCoupon = null;
    let discountAmount = 0;
    if (targetCouponCode) {
      const couponResult = await resolveOrderCoupon(targetCouponCode, calculatedSubtotal, userId);
      if (couponResult.error) {
        // Rollback stock
        for (const rolled of deductedItems) {
          await Product.updateOne(
            { _id: rolled.product, "variants._id": rolled.variantId },
            { $inc: { "variants.$.stock": rolled.quantity, stock: rolled.quantity } }
          );
        }
        return res.status(400).json({
          success: false,
          message: couponResult.error,
        });
      }
      appliedCoupon = couponResult.coupon;
    }

    // Authoritative Product-Level Coupon Allocation
    const allocation = calculateItemCouponAllocations({
      items: orderItems,
      coupon: appliedCoupon,
      merchandiseSubtotal: calculatedSubtotal,
    });

    const finalOrderItems = allocation.allocatedItems;
    discountAmount = allocation.totalCouponDiscount;
    const discountedMerchandiseTotal = allocation.discountedMerchandiseTotal;

    const shippingCost = calculatedSubtotal >= 5000 ? 0 : 250;
    const totalAmount = Math.max(0, discountedMerchandiseTotal) + shippingCost;

    // 5. Generate unique order number
    const orderNumber = `FEXA-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 6. Create immutable order snapshot or reuse existing internal order
    const isRazorpay = paymentMethod === "Razorpay" || Boolean(req.body.razorpay_payment_id);
    let order = null;

    if (req.body.orderId && mongoose.Types.ObjectId.isValid(req.body.orderId)) {
      order = await Order.findOne({ _id: req.body.orderId, user: userId });
    }

    if (order && order.paymentStatus !== "Paid") {
      order.items = finalOrderItems;
      order.shippingAddress = shippingAddressSnapshot;
      order.subtotal = calculatedSubtotal;
      order.originalSubtotal = originalSubtotal;
      order.totalOfferDiscount = totalOfferDiscount;
      order.coupon = appliedCoupon ? appliedCoupon._id : (order.coupon || null);
      order.couponCode = appliedCoupon ? appliedCoupon.code : (order.couponCode || null);
      order.couponName = appliedCoupon ? appliedCoupon.name : (order.couponName || null);
      order.discountPercentage = appliedCoupon ? appliedCoupon.discountPercentage : (order.discountPercentage || null);
      order.discountAmount = discountAmount;
      order.eligibleSubtotal = calculatedSubtotal;
      order.shippingCost = shippingCost;
      order.totalAmount = totalAmount;
      order.paymentMethod = isRazorpay ? "Razorpay" : paymentMethod;
      order.paymentStatus = paymentMethod === "COD" ? "Pending" : "Paid";
      order.orderStatus = "Processing";
      order.paymentFailureReason = null;
      order.paymentErrorCode = null;
      if (req.body.razorpay_order_id) order.razorpayOrderId = req.body.razorpay_order_id;
      if (req.body.razorpay_payment_id) order.razorpayPaymentId = req.body.razorpay_payment_id;
      if (req.body.razorpay_signature) order.razorpaySignature = req.body.razorpay_signature;
      await order.save();
    } else {
      order = await Order.create({
        orderNumber,
        user: userId,
        items: finalOrderItems,
        shippingAddress: shippingAddressSnapshot,
        subtotal: calculatedSubtotal,
        originalSubtotal,
        totalOfferDiscount,
        coupon: appliedCoupon ? appliedCoupon._id : null,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        couponName: appliedCoupon ? appliedCoupon.name : null,
        discountPercentage: appliedCoupon ? appliedCoupon.discountPercentage : null,
        discountAmount,
        eligibleSubtotal: calculatedSubtotal,
        shippingCost,
        totalAmount,
        paymentMethod: isRazorpay ? "Razorpay" : paymentMethod,
        paymentStatus: paymentMethod === "COD" ? "Pending" : "Paid",
        orderStatus: "Processing",
        razorpayOrderId: req.body.razorpay_order_id || null,
        razorpayPaymentId: req.body.razorpay_payment_id || null,
        razorpaySignature: req.body.razorpay_signature || null,
      });
    }

    // If order confirmed as COD, commit coupon usage atomically
    if (paymentMethod === "COD" && (appliedCoupon || order.coupon)) {
      const targetCouponId = appliedCoupon ? appliedCoupon._id : order.coupon;
      await Coupon.updateOne(
        { _id: targetCouponId },
        {
          $inc: { usedCount: 1 },
          $push: {
            userRedemptions: {
              user: userId,
              orderId: order._id,
              redeemedAt: new Date(),
            },
          },
        }
      );
    }

    // 7. Clear user's cart if exists
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      order: normalizeOrderWithAllocations(order.toObject ? order.toObject() : order),
    });
  } catch (error) {
    console.error("Create order error:", error);

    // Rollback any deducted inventory
    for (const rolled of deductedItems) {
      try {
        await Product.updateOne(
          { _id: rolled.product, "variants._id": rolled.variantId },
          {
            $inc: {
              "variants.$.stock": rolled.quantity,
              stock: rolled.quantity,
            },
          }
        );
      } catch (rollbackErr) {
        console.error("Rollback error:", rollbackErr);
      }
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process order. Please try again.",
    });
  }
};

// ========================================================
// GET CURRENT USER ORDERS
// ========================================================
const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
    const normalizedOrders = orders.map((o) =>
      normalizeOrderWithAllocations(o.toObject ? o.toObject() : o)
    );

    return res.status(200).json({
      success: true,
      orders: normalizedOrders,
    });
  } catch (error) {
    console.error("Get my orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve order history.",
    });
  }
};

// ========================================================
// GET SINGLE ORDER BY ID
// ========================================================
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({
      _id: id,
      user: userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    const normalizedOrder = normalizeOrderWithAllocations(
      order.toObject ? order.toObject() : order
    );

    return res.status(200).json({
      success: true,
      order: normalizedOrder,
    });
  } catch (error) {
    console.error("Get order by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve order details.",
    });
  }
};

// ========================================================
// GET PUBLIC RAZORPAY KEY ID
// ========================================================
const getRazorpayKey = async (req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_TqUYTgZOU4T32M";
    return res.status(200).json({
      success: true,
      keyId,
    });
  } catch (error) {
    console.error("Get Razorpay key error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve payment configuration.",
    });
  }
};

// ========================================================
// CREATE RAZORPAY ORDER (Initiate checkout session & internal order)
// ========================================================
const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId, shippingAddressId, orderId: retryOrderId, couponCode } = req.body;

    // 1. Verify user & delivery address
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const targetAddressId =
      addressId ||
      shippingAddressId ||
      (req.body.shippingAddress && req.body.shippingAddress._id);

    if (!targetAddressId) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid saved delivery address from your profile.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(targetAddressId)) {
      return res.status(400).json({
        success: false,
        message: "The selected delivery address identifier is invalid.",
      });
    }

    const selectedAddress = user.addresses.id(targetAddressId);
    if (!selectedAddress) {
      return res.status(400).json({
        success: false,
        message: "The selected delivery address does not exist or does not belong to your account.",
      });
    }

    const addressLineSnapshot =
      [selectedAddress.house, selectedAddress.street]
        .filter((part) => part && part.trim())
        .join(", ") || selectedAddress.addressLine || "";

    const shippingAddressSnapshot = {
      addressId: selectedAddress._id,
      label: selectedAddress.label || "Home",
      fullName: selectedAddress.fullName.trim(),
      phone: selectedAddress.phone.trim(),
      house: (selectedAddress.house || "").trim(),
      street: (selectedAddress.street || "").trim(),
      addressLine: addressLineSnapshot.trim(),
      city: selectedAddress.city.trim(),
      state: (selectedAddress.state || "").trim(),
      pincode: selectedAddress.pincode.trim(),
      country: selectedAddress.country || "India",
    };

    // 2. Fetch items from body or user's active cart
    const cart = await Cart.findOne({ user: userId });
    const sourceItems =
      Array.isArray(req.body.items) && req.body.items.length > 0
        ? req.body.items
        : cart && cart.items
        ? cart.items
        : [];

    if (sourceItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your shopping bag is empty. Please add fragrances before initiating payment.",
      });
    }

    const activeOffers = await getActiveValidOffers();
    const orderItems = [];
    let calculatedSubtotal = 0;
    let originalSubtotal = 0;
    let totalOfferDiscount = 0;

    // 3. Validate stock & live price
    for (const item of sourceItems) {
      const prodId = item.productId || item.product;
      const product = await Product.findById(prodId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "One of the fragrances is no longer available in our collection.",
        });
      }

      const categoryDoc = await Category.findOne({ name: product.category });
      if (categoryDoc && !categoryDoc.isActive) {
        return res.status(400).json({
          success: false,
          message: `"${product.name}" belongs to the ${product.category} collection, which is currently unavailable for purchase.`,
        });
      }

      if (product.status === "Inactive") {
        return res.status(400).json({
          success: false,
          message: `"${product.name}" is currently unavailable.`,
        });
      }

      let variant = null;
      if (product.variants && product.variants.length > 0) {
        if (item.variantId) {
          variant = product.variants.find(
            (v) => v._id.toString() === item.variantId.toString()
          );
        } else if (product.variants.length === 1) {
          variant = product.variants[0];
        }
      }

      if (!variant) {
        return res.status(400).json({
          success: false,
          message: `Please select a valid size variant for "${product.name}".`,
        });
      }

      if (variant.isAvailable === false) {
        return res.status(400).json({
          success: false,
          message: `The ${variant.volumeMl} ml size of "${product.name}" is discontinued or unavailable.`,
        });
      }

      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty < 1 || qty > 5) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for "${product.name}". Max 5 units allowed.`,
        });
      }

      if (qty > variant.stock) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}" (${variant.volumeMl} ml). Available: ${variant.stock}.`,
        });
      }

      // Live MongoDB price calculation with automatic offer discount
      const basePrice = roundToPaise(variant.sellingPrice);
      const originalPrice = basePrice;
      const bestOffer = findBestOfferForProduct(product, activeOffers, basePrice);
      const unitPrice = bestOffer.offerPrice;
      const unitOfferDiscount = bestOffer.discountAmount;
      const lineOfferDiscount = roundToPaise(unitOfferDiscount * qty);
      const lineTotal = roundToPaise(unitPrice * qty);

      calculatedSubtotal += lineTotal;
      originalSubtotal += roundToPaise(originalPrice * qty);
      totalOfferDiscount += lineOfferDiscount;

      orderItems.push({
        product: product._id,
        variantId: variant._id,
        name: product.name,
        brand: product.brand || "FEXA",
        category: product.category,
        volumeMl: variant.volumeMl,
        quantity: qty,
        unitPrice,
        originalPrice,
        appliedOffer: bestOffer.offer ? bestOffer.offer._id : null,
        offerName: bestOffer.offer ? bestOffer.offer.name : null,
        offerDiscountPercentage: bestOffer.discountPercentage || null,
        offerDiscount: unitOfferDiscount,
        offerAdjustedUnitPrice: unitPrice,
        lineTotal,
        image: product.images && product.images.length > 0 ? product.images[0] : null,
      });
    }

    // 4. Resolve coupon & calculate discount
    let targetCouponCode = couponCode;
    if (!targetCouponCode && retryOrderId && mongoose.Types.ObjectId.isValid(retryOrderId)) {
      const prevOrder = await Order.findOne({ _id: retryOrderId, user: userId });
      if (prevOrder && prevOrder.couponCode) {
        targetCouponCode = prevOrder.couponCode;
      }
    }

    let appliedCoupon = null;
    let discountAmount = 0;
    if (targetCouponCode) {
      const couponResult = await resolveOrderCoupon(targetCouponCode, calculatedSubtotal, userId);
      if (couponResult.error) {
        return res.status(400).json({
          success: false,
          message: couponResult.error,
        });
      }
      appliedCoupon = couponResult.coupon;
    }

    // Authoritative Product-Level Coupon Allocation
    const allocation = calculateItemCouponAllocations({
      items: orderItems,
      coupon: appliedCoupon,
      merchandiseSubtotal: calculatedSubtotal,
    });

    const finalOrderItems = allocation.allocatedItems;
    discountAmount = allocation.totalCouponDiscount;
    const discountedMerchandiseTotal = allocation.discountedMerchandiseTotal;

    const shippingCost = calculatedSubtotal >= 5000 ? 0 : 250;
    const totalAmount = Math.max(0, discountedMerchandiseTotal) + shippingCost;

    if (totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order amount for checkout.",
      });
    }

    // 5. Create or reuse internal Order (safe retry flow without duplicate orders)
    let internalOrder = null;

    if (retryOrderId && mongoose.Types.ObjectId.isValid(retryOrderId)) {
      internalOrder = await Order.findOne({ _id: retryOrderId, user: userId });
      if (internalOrder && internalOrder.paymentStatus !== "Paid") {
        internalOrder.items = finalOrderItems;
        internalOrder.shippingAddress = shippingAddressSnapshot;
        internalOrder.subtotal = calculatedSubtotal;
        internalOrder.originalSubtotal = originalSubtotal;
        internalOrder.totalOfferDiscount = totalOfferDiscount;
        internalOrder.coupon = appliedCoupon ? appliedCoupon._id : (internalOrder.coupon || null);
        internalOrder.couponCode = appliedCoupon ? appliedCoupon.code : (internalOrder.couponCode || null);
        internalOrder.couponName = appliedCoupon ? appliedCoupon.name : (internalOrder.couponName || null);
        internalOrder.discountPercentage = appliedCoupon ? appliedCoupon.discountPercentage : (internalOrder.discountPercentage || null);
        internalOrder.discountAmount = discountAmount;
        internalOrder.eligibleSubtotal = calculatedSubtotal;
        internalOrder.shippingCost = shippingCost;
        internalOrder.totalAmount = totalAmount;
        internalOrder.paymentMethod = "Razorpay";
        internalOrder.paymentStatus = "Pending";
        internalOrder.paymentFailureReason = null;
        internalOrder.paymentErrorCode = null;
        internalOrder.paymentAttempts = (internalOrder.paymentAttempts || 1) + 1;
      } else {
        internalOrder = null;
      }
    }

    if (!internalOrder) {
      const orderNumber = `FEXA-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      internalOrder = await Order.create({
        orderNumber,
        user: userId,
        items: finalOrderItems,
        shippingAddress: shippingAddressSnapshot,
        subtotal: calculatedSubtotal,
        originalSubtotal,
        totalOfferDiscount,
        coupon: appliedCoupon ? appliedCoupon._id : null,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        couponName: appliedCoupon ? appliedCoupon.name : null,
        discountPercentage: appliedCoupon ? appliedCoupon.discountPercentage : null,
        discountAmount,
        eligibleSubtotal: calculatedSubtotal,
        shippingCost,
        totalAmount,
        paymentMethod: "Razorpay",
        paymentStatus: "Pending",
        orderStatus: "Processing",
        paymentAttempts: 1,
      });
    }

    // 6. Create Razorpay order via Razorpay API with final discounted amount
    const razorpay = getRazorpayInstance();
    const amountInPaisa = Math.round(totalAmount * 100);

    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaisa,
      currency: "INR",
      receipt: internalOrder.orderNumber,
      notes: {
        internalOrderId: internalOrder._id.toString(),
        userId: userId.toString(),
        orderNumber: internalOrder.orderNumber,
        couponCode: appliedCoupon ? appliedCoupon.code : "",
      },
    });

    internalOrder.razorpayOrderId = rzpOrder.id;
    await internalOrder.save();

    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_TqUYTgZOU4T32M";

    return res.status(200).json({
      success: true,
      keyId,
      orderId: internalOrder._id,
      orderNumber: internalOrder.orderNumber,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      totalAmount,
      subtotal: calculatedSubtotal,
      discountAmount,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      couponName: appliedCoupon ? appliedCoupon.name : null,
      shippingCost,
      customer: {
        name: selectedAddress.fullName || user.name || "",
        email: user.email || "",
        phone: selectedAddress.phone || user.phone || "",
      },
    });
  } catch (error) {
    console.error("Create Razorpay order error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to initialize Razorpay checkout.",
    });
  }
};

// ========================================================
// VERIFY RAZORPAY PAYMENT & COMPLETE ORDER
// ========================================================
const verifyRazorpayPayment = async (req, res) => {
  const deductedItems = [];

  try {
    const userId = req.user.id;
    const {
      orderId,
      addressId,
      shippingAddressId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentMethod = "Razorpay",
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing Razorpay payment verification parameters.",
      });
    }

    // 1. Verify HMAC SHA256 Signature
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "vlYvPndeLZ07y6a3ovxB3aPp";
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed. Untrusted transaction.",
      });
    }

    // 2. Prevent replay attacks & check idempotency
    const existingPaymentOrder = await Order.findOne({ razorpayPaymentId: razorpay_payment_id });
    if (existingPaymentOrder && existingPaymentOrder.paymentStatus === "Paid") {
      return res.status(201).json({
        success: true,
        message: "Order already verified and confirmed.",
        order: existingPaymentOrder,
      });
    }

    // 3. Find the internal order
    let targetOrder = null;
    if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
      targetOrder = await Order.findOne({ _id: orderId, user: userId });
    }
    if (!targetOrder && razorpay_order_id) {
      targetOrder = await Order.findOne({ razorpayOrderId: razorpay_order_id, user: userId });
    }

    // If order was already confirmed as Paid
    if (targetOrder && targetOrder.paymentStatus === "Paid") {
      return res.status(201).json({
        success: true,
        message: "Order already verified and confirmed.",
        order: targetOrder,
      });
    }

    // 4. User and Address verification
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const targetAddressId =
      addressId ||
      shippingAddressId ||
      (targetOrder && targetOrder.shippingAddress && targetOrder.shippingAddress.addressId) ||
      (req.body.shippingAddress && req.body.shippingAddress._id);

    if (!targetAddressId || !mongoose.Types.ObjectId.isValid(targetAddressId)) {
      return res.status(400).json({
        success: false,
        message: "The selected delivery address identifier is invalid.",
      });
    }

    const selectedAddress = user.addresses.id(targetAddressId);
    if (!selectedAddress) {
      return res.status(400).json({
        success: false,
        message: "The selected delivery address does not exist or does not belong to your account.",
      });
    }

    const addressLineSnapshot =
      [selectedAddress.house, selectedAddress.street]
        .filter((part) => part && part.trim())
        .join(", ") || selectedAddress.addressLine || "";

    const shippingAddressSnapshot = {
      addressId: selectedAddress._id,
      label: selectedAddress.label || "Home",
      fullName: selectedAddress.fullName.trim(),
      phone: selectedAddress.phone.trim(),
      house: (selectedAddress.house || "").trim(),
      street: (selectedAddress.street || "").trim(),
      addressLine: addressLineSnapshot.trim(),
      city: selectedAddress.city.trim(),
      state: (selectedAddress.state || "").trim(),
      pincode: selectedAddress.pincode.trim(),
      country: selectedAddress.country || "India",
    };

    // 5. Source items from targetOrder, body, or active cart
    const cart = await Cart.findOne({ user: userId });
    const sourceItems =
      targetOrder && targetOrder.items && targetOrder.items.length > 0
        ? targetOrder.items
        : Array.isArray(req.body.items) && req.body.items.length > 0
        ? req.body.items
        : cart && cart.items
        ? cart.items
        : [];

    if (sourceItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your shopping bag is empty. Please add fragrances before placing an order.",
      });
    }

    const activeOffers = await getActiveValidOffers();
    const orderItems = [];
    let calculatedSubtotal = 0;
    let originalSubtotal = 0;
    let totalOfferDiscount = 0;

    for (const item of sourceItems) {
      const prodId = item.productId || item.product;
      const product = await Product.findById(prodId);
      if (!product || product.status === "Inactive") {
        return res.status(400).json({
          success: false,
          message: `Fragrance "${item.name || "Product"}" is currently unavailable.`,
        });
      }

      let variant = null;
      if (product.variants && product.variants.length > 0) {
        if (item.variantId) {
          variant = product.variants.find(
            (v) => v._id.toString() === item.variantId.toString()
          );
        } else if (product.variants.length === 1) {
          variant = product.variants[0];
        }
      }

      if (!variant || variant.isAvailable === false) {
        return res.status(400).json({
          success: false,
          message: `Size variant for "${product.name}" is discontinued or unavailable.`,
        });
      }

      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty < 1 || qty > 5) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for "${product.name}". Max 5 units allowed.`,
        });
      }

      if (qty > variant.stock) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}" (${variant.volumeMl} ml). Available: ${variant.stock}.`,
        });
      }

      // Live MongoDB price calculation with automatic offer discount
      const basePrice = roundToPaise(variant.sellingPrice);
      const originalPrice = basePrice;
      const bestOffer = findBestOfferForProduct(product, activeOffers, basePrice);
      const unitPrice = bestOffer.offerPrice;
      const unitOfferDiscount = bestOffer.discountAmount;
      const lineOfferDiscount = roundToPaise(unitOfferDiscount * qty);
      const lineTotal = roundToPaise(unitPrice * qty);

      calculatedSubtotal += lineTotal;
      originalSubtotal += roundToPaise(originalPrice * qty);
      totalOfferDiscount += lineOfferDiscount;

      orderItems.push({
        product: product._id,
        variantId: variant._id,
        name: product.name,
        brand: product.brand || "FEXA",
        category: product.category,
        volumeMl: variant.volumeMl,
        quantity: qty,
        unitPrice,
        originalPrice,
        appliedOffer: bestOffer.offer ? bestOffer.offer._id : null,
        offerName: bestOffer.offer ? bestOffer.offer.name : null,
        offerDiscountPercentage: bestOffer.discountPercentage || null,
        offerDiscount: unitOfferDiscount,
        offerAdjustedUnitPrice: unitPrice,
        lineTotal,
        image: product.images && product.images.length > 0 ? product.images[0] : null,
      });
    }

    // 6. Atomically deduct inventory
    for (const it of orderItems) {
      const updateResult = await Product.updateOne(
        {
          _id: it.product,
          "variants._id": it.variantId,
          "variants.stock": { $gte: it.quantity },
        },
        {
          $inc: {
            "variants.$.stock": -it.quantity,
            stock: -it.quantity,
          },
        }
      );

      if (updateResult.matchedCount === 0 || updateResult.modifiedCount === 0) {
        // Concurrency rollback
        for (const rolled of deductedItems) {
          await Product.updateOne(
            { _id: rolled.product, "variants._id": rolled.variantId },
            {
              $inc: {
                "variants.$.stock": rolled.quantity,
                stock: rolled.quantity,
              },
            }
          );
        }

        return res.status(400).json({
          success: false,
          message: `Could not reserve stock for ${it.name} (${it.volumeMl} ml). Another patron may have just placed an order.`,
        });
      }

      deductedItems.push({
        product: it.product,
        variantId: it.variantId,
        quantity: it.quantity,
      });

      const updatedProd = await Product.findById(it.product);
      if (updatedProd && updatedProd.stock <= 0 && updatedProd.status === "Active") {
        updatedProd.status = "Out of Stock";
        await updatedProd.save();
      }
    }

    let targetCouponCode = (req.body && req.body.couponCode) || (targetOrder && targetOrder.couponCode);
    let appliedCoupon = null;
    let discountAmount = targetOrder ? targetOrder.discountAmount || 0 : 0;

    if (targetCouponCode) {
      const couponResult = await resolveOrderCoupon(targetCouponCode, calculatedSubtotal, userId);
      if (!couponResult.error && couponResult.coupon) {
        appliedCoupon = couponResult.coupon;
      } else if (targetOrder && targetOrder.coupon) {
        appliedCoupon = await Coupon.findById(targetOrder.coupon);
      }
    } else if (targetOrder && targetOrder.coupon) {
      appliedCoupon = await Coupon.findById(targetOrder.coupon);
    }

    // Authoritative Product-Level Coupon Allocation
    const allocation = calculateItemCouponAllocations({
      items: orderItems,
      coupon: appliedCoupon,
      merchandiseSubtotal: calculatedSubtotal,
    });

    const finalOrderItems = allocation.allocatedItems;
    discountAmount = allocation.totalCouponDiscount;
    const discountedMerchandiseTotal = allocation.discountedMerchandiseTotal;

    const shippingCost = calculatedSubtotal >= 5000 ? 0 : 250;
    const totalAmount = Math.max(0, discountedMerchandiseTotal) + shippingCost;

    let finalOrder = targetOrder;

    if (finalOrder) {
      finalOrder.items = finalOrderItems;
      finalOrder.shippingAddress = shippingAddressSnapshot;
      finalOrder.subtotal = calculatedSubtotal;
      finalOrder.originalSubtotal = originalSubtotal;
      finalOrder.totalOfferDiscount = totalOfferDiscount;
      finalOrder.coupon = appliedCoupon ? appliedCoupon._id : (targetOrder ? targetOrder.coupon : null);
      finalOrder.couponCode = appliedCoupon ? appliedCoupon.code : (targetOrder ? targetOrder.couponCode : null);
      finalOrder.couponName = appliedCoupon ? appliedCoupon.name : (targetOrder ? targetOrder.couponName : null);
      finalOrder.discountPercentage = appliedCoupon ? appliedCoupon.discountPercentage : (targetOrder ? targetOrder.discountPercentage : null);
      finalOrder.discountAmount = discountAmount;
      finalOrder.eligibleSubtotal = calculatedSubtotal;
      finalOrder.shippingCost = shippingCost;
      finalOrder.totalAmount = totalAmount;
      finalOrder.paymentMethod = paymentMethod || "Razorpay";
      finalOrder.paymentStatus = "Paid";
      finalOrder.orderStatus = "Processing";
      finalOrder.razorpayOrderId = razorpay_order_id;
      finalOrder.razorpayPaymentId = razorpay_payment_id;
      finalOrder.razorpaySignature = razorpay_signature;
      finalOrder.paymentFailureReason = null;
      finalOrder.paymentErrorCode = null;
      await finalOrder.save();
    } else {
      const orderNumber = `FEXA-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      finalOrder = await Order.create({
        orderNumber,
        user: userId,
        items: finalOrderItems,
        shippingAddress: shippingAddressSnapshot,
        subtotal: calculatedSubtotal,
        originalSubtotal,
        totalOfferDiscount,
        coupon: appliedCoupon ? appliedCoupon._id : null,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        couponName: appliedCoupon ? appliedCoupon.name : null,
        discountPercentage: appliedCoupon ? appliedCoupon.discountPercentage : null,
        discountAmount,
        eligibleSubtotal: calculatedSubtotal,
        shippingCost,
        totalAmount,
        paymentMethod: paymentMethod || "Razorpay",
        paymentStatus: "Paid",
        orderStatus: "Processing",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      });
    }

    // Commit coupon redemption atomically
    if (finalOrder.coupon) {
      await Coupon.updateOne(
        { _id: finalOrder.coupon },
        {
          $inc: { usedCount: 1 },
          $push: {
            userRedemptions: {
              user: userId,
              orderId: finalOrder._id,
              redeemedAt: new Date(),
            },
          },
        }
      );
    }

    // 7. Clear cart ONCE only after verified success
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    return res.status(201).json({
      success: true,
      message: "Payment successfully verified and order reserved.",
      order: normalizeOrderWithAllocations(finalOrder.toObject ? finalOrder.toObject() : finalOrder),
    });
  } catch (error) {
    console.error("Verify Razorpay payment error:", error);

    for (const rolled of deductedItems) {
      try {
        await Product.updateOne(
          { _id: rolled.product, "variants._id": rolled.variantId },
          {
            $inc: {
              "variants.$.stock": rolled.quantity,
              stock: rolled.quantity,
            },
          }
        );
      } catch (rollbackErr) {
        console.error("Rollback error:", rollbackErr);
      }
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to verify payment and process order.",
    });
  }
};

// ========================================================
// RECORD PAYMENT FAILURE (Without marking paid or clearing cart)
// ========================================================
const recordPaymentFailure = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      orderId,
      razorpay_order_id,
      razorpayOrderId,
      razorpay_payment_id,
      razorpayPaymentId,
      errorCode,
      code,
      errorDescription,
      description,
      errorReason,
      reason,
      errorStep,
      step,
    } = req.body;

    let targetOrder = null;

    if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
      targetOrder = await Order.findOne({ _id: orderId, user: userId });
    }

    const targetRzpOrderId = razorpayOrderId || razorpay_order_id;
    if (!targetOrder && targetRzpOrderId) {
      targetOrder = await Order.findOne({ razorpayOrderId: targetRzpOrderId, user: userId });
    }

    if (!targetOrder) {
      return res.status(404).json({
        success: false,
        message: "Order reference not found.",
      });
    }

    // Never mark an order as failed if it was already successfully Paid!
    if (targetOrder.paymentStatus === "Paid") {
      return res.status(200).json({
        success: true,
        message: "Order was already confirmed as paid.",
        order: targetOrder,
      });
    }

    const failureReason =
      errorDescription ||
      description ||
      errorReason ||
      reason ||
      (errorStep || step ? `Payment failed at step: ${errorStep || step}` : "Payment was cancelled or unsuccessful.");

    targetOrder.paymentStatus = "Failed";
    targetOrder.paymentFailureReason = failureReason;
    targetOrder.paymentErrorCode = errorCode || code || "PAYMENT_FAILED";
    const targetPaymentId = razorpayPaymentId || razorpay_payment_id;
    if (targetPaymentId) {
      targetOrder.razorpayPaymentId = targetPaymentId;
    }
    targetOrder.paymentAttempts = (targetOrder.paymentAttempts || 1) + 1;
    await targetOrder.save();

    // Note: Cart is NOT cleared! Inventory is NOT deducted!
    return res.status(200).json({
      success: true,
      message: "Payment failure recorded. Cart and checkout details retained for retry.",
      order: targetOrder,
    });
  } catch (error) {
    console.error("Record payment failure error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to record payment failure.",
    });
  }
};

// ========================================================
// CHECK ORDER STATUS (Handle interrupted requests / polling)
// ========================================================
const checkOrderStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findOne({ _id: orderId, user: userId });
    }

    if (!order) {
      order = await Order.findOne({ razorpayOrderId: orderId, user: userId });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    // If order is still Pending and has a Razorpay Order ID, check with Razorpay API
    if (order.paymentStatus === "Pending" && order.razorpayOrderId) {
      try {
        const razorpay = getRazorpayInstance();
        const paymentsResponse = await razorpay.orders.fetchPayments(order.razorpayOrderId);
        if (paymentsResponse && paymentsResponse.items && paymentsResponse.items.length > 0) {
          const capturedPayment = paymentsResponse.items.find(
            (p) => p.status === "captured"
          );

          if (capturedPayment) {
            const deductedItems = [];
            let stockOk = true;

            for (const it of order.items) {
              const updateResult = await Product.updateOne(
                {
                  _id: it.product,
                  "variants._id": it.variantId,
                  "variants.stock": { $gte: it.quantity },
                },
                {
                  $inc: {
                    "variants.$.stock": -it.quantity,
                    stock: -it.quantity,
                  },
                }
              );

              if (updateResult.matchedCount === 0 || updateResult.modifiedCount === 0) {
                stockOk = false;
                break;
              }
              deductedItems.push(it);
            }

            if (stockOk) {
              order.paymentStatus = "Paid";
              order.orderStatus = "Processing";
              order.razorpayPaymentId = capturedPayment.id;
              order.paymentFailureReason = null;
              order.paymentErrorCode = null;
              await order.save();

              // Commit coupon usage if order has coupon
              if (order.coupon) {
                await Coupon.updateOne(
                  { _id: order.coupon },
                  {
                    $inc: { usedCount: 1 },
                    $push: {
                      userRedemptions: {
                        user: userId,
                        orderId: order._id,
                        redeemedAt: new Date(),
                      },
                    },
                  }
                );
              }

              const cart = await Cart.findOne({ user: userId });
              if (cart) {
                cart.items = [];
                await cart.save();
              }
            } else {
              for (const rolled of deductedItems) {
                await Product.updateOne(
                  { _id: rolled.product, "variants._id": rolled.variantId },
                  { $inc: { "variants.$.stock": rolled.quantity, stock: rolled.quantity } }
                );
              }
            }
          }
        }
      } catch (rzpErr) {
        console.warn("Could not fetch payments from Razorpay API for status check:", rzpErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      order,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
    });
  } catch (error) {
    console.error("Check order status error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve payment and order status.",
    });
  }
};

// ========================================================
// RAZORPAY WEBHOOK HANDLER (Asynchronous event fallback)
// ========================================================
const handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers["x-razorpay-signature"];
      if (!signature) {
        return res.status(400).json({ success: false, message: "Missing webhook signature." });
      }
      const shasum = crypto.createHmac("sha256", webhookSecret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest("hex");
      if (digest !== signature) {
        return res.status(400).json({ success: false, message: "Invalid webhook signature." });
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = payload.payment ? payload.payment.entity : null;
      const rzpOrderId = paymentEntity ? paymentEntity.order_id : payload.order ? payload.order.entity.id : null;

      if (rzpOrderId) {
        const order = await Order.findOne({ razorpayOrderId: rzpOrderId });
        if (order && order.paymentStatus !== "Paid") {
          const deductedItems = [];
          let stockOk = true;

          for (const it of order.items) {
            const updateResult = await Product.updateOne(
              {
                _id: it.product,
                "variants._id": it.variantId,
                "variants.stock": { $gte: it.quantity },
              },
              {
                $inc: {
                  "variants.$.stock": -it.quantity,
                  stock: -it.quantity,
                },
              }
            );

            if (updateResult.matchedCount === 0 || updateResult.modifiedCount === 0) {
              stockOk = false;
              break;
            }
            deductedItems.push(it);
          }

          if (stockOk) {
            order.paymentStatus = "Paid";
            order.orderStatus = "Processing";
            if (paymentEntity && paymentEntity.id) {
              order.razorpayPaymentId = paymentEntity.id;
            }
            order.paymentFailureReason = null;
            order.paymentErrorCode = null;
            await order.save();

            // Commit coupon usage if order has coupon
            if (order.coupon) {
              await Coupon.updateOne(
                { _id: order.coupon },
                {
                  $inc: { usedCount: 1 },
                  $push: {
                    userRedemptions: {
                      user: order.user,
                      orderId: order._id,
                      redeemedAt: new Date(),
                    },
                  },
                }
              );
            }

            const cart = await Cart.findOne({ user: order.user });
            if (cart) {
              cart.items = [];
              await cart.save();
            }
          } else {
            for (const rolled of deductedItems) {
              await Product.updateOne(
                { _id: rolled.product, "variants._id": rolled.variantId },
                { $inc: { "variants.$.stock": rolled.quantity, stock: rolled.quantity } }
              );
            }
          }
        }
      }
    } else if (event === "payment.failed") {
      const paymentEntity = payload.payment ? payload.payment.entity : null;
      const rzpOrderId = paymentEntity ? paymentEntity.order_id : null;
      if (rzpOrderId) {
        const order = await Order.findOne({ razorpayOrderId: rzpOrderId });
        if (order && order.paymentStatus !== "Paid") {
          order.paymentStatus = "Failed";
          order.paymentFailureReason = paymentEntity.error_description || "Payment failed via gateway";
          order.paymentErrorCode = paymentEntity.error_code || "PAYMENT_FAILED";
          if (paymentEntity.id) order.razorpayPaymentId = paymentEntity.id;
          await order.save();
        }
      }
    }

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("Razorpay webhook error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

// ========================================================
// 10. USER: REQUEST RETURN FOR A SPECIFIC ORDER ITEM
// ========================================================
const requestItemReturn = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId, itemId } = req.params;
    const { quantity = 1, reason = "Customer Return" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: "Invalid order or item identifier." });
    }

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found in your vault history." });
    }

    if (order.orderStatus !== "Delivered") {
      return res.status(400).json({
        success: false,
        message: "Returns can only be requested for orders that have been successfully delivered.",
      });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Fragrance line item not found in order." });
    }

    if (item.itemStatus === "Return Requested") {
      return res.status(400).json({
        success: false,
        message: "A return request is already under review for this fragrance.",
      });
    }

    const requestedQty = parseInt(quantity, 10);
    const availableQty = (item.quantity || 1) - (item.returnedQuantity || 0);

    if (isNaN(requestedQty) || requestedQty < 1 || requestedQty > availableQty) {
      return res.status(400).json({
        success: false,
        message: `Invalid return quantity. You can return between 1 and ${availableQty} unit(s).`,
      });
    }

    item.itemStatus = "Return Requested";
    item.requestedReturnQuantity = requestedQty;
    item.returnReason = String(reason || "Customer Return").trim();
    item.returnRequestedAt = new Date();
    item.refundStatus = "Pending";

    await order.save();

    const normalized = normalizeOrderWithAllocations(order.toObject ? order.toObject() : order);
    const updatedItem = normalized.items.find((it) => it._id.toString() === itemId.toString());
    const refundBase = calculateItemRefund(updatedItem, requestedQty).refundAmount;

    return res.status(200).json({
      success: true,
      message: `Return request for ${requestedQty} unit(s) of "${item.name}" submitted successfully.`,
      order: normalized,
      estimatedRefund: refundBase,
    });
  } catch (error) {
    console.error("Request item return error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit return request.",
    });
  }
};

// ========================================================
// 11. ADMIN: APPROVE ITEM RETURN & DISBURSE REFUND
// ========================================================
const approveItemReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { quantity } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: "Invalid order or item identifier." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Fragrance item not found in order." });
    }

    const returnQty = parseInt(quantity || item.requestedReturnQuantity || 1, 10);
    const availableQty = (item.quantity || 1) - (item.returnedQuantity || 0);

    if (isNaN(returnQty) || returnQty < 1 || returnQty > availableQty) {
      return res.status(400).json({
        success: false,
        message: `Cannot approve return: requested ${returnQty} unit(s), but only ${availableQty} unit(s) eligible.`,
      });
    }

    // Ensure item has stored allocations (reconstructed safely if historical)
    const normalizedOrder = normalizeOrderWithAllocations(order.toObject ? order.toObject() : order);
    const normalizedItem = normalizedOrder.items.find((it) => it._id.toString() === itemId.toString());

    // Calculate authoritative refund based on discounted amount actually paid
    const refundCalc = calculateItemRefund(normalizedItem, returnQty);
    const refundAmount = refundCalc.refundAmount;

    let refundTransactionId = null;

    // Disburse online Razorpay refund if paid via Razorpay
    if (order.paymentMethod === "Razorpay" && order.razorpayPaymentId && order.paymentStatus === "Paid") {
      try {
        const razorpay = getRazorpayInstance();
        const refundResponse = await razorpay.payments.refund(order.razorpayPaymentId, {
          amount: Math.round(refundAmount * 100), // in paise
          notes: {
            orderNumber: order.orderNumber,
            productName: item.name,
            volumeMl: item.volumeMl,
            returnedQuantity: returnQty,
          },
        });
        refundTransactionId = refundResponse?.id || `RZP-RFND-${Date.now()}`;
      } catch (rzpErr) {
        console.warn("Razorpay API online refund notice (recording internal ledger):", rzpErr.message);
        refundTransactionId = `RFND-${Date.now()}`;
      }
    } else {
      refundTransactionId = `COD-RFND-${Date.now()}`;
    }

    // Atomically restore perfume variant inventory stock in MongoDB
    if (item.product && item.variantId) {
      await Product.updateOne(
        { _id: item.product, "variants._id": item.variantId },
        {
          $inc: {
            "variants.$.stock": returnQty,
            stock: returnQty,
          },
        }
      );
    }

    // Save allocation snapshot on order item if not previously stored
    item.allocatedCouponDiscount = normalizedItem.allocatedCouponDiscount;
    item.discountedLineAmount = normalizedItem.discountedLineAmount;
    item.perUnitDiscount = normalizedItem.perUnitDiscount;
    item.discountedUnitAmount = normalizedItem.discountedUnitAmount;

    item.returnedQuantity = (item.returnedQuantity || 0) + returnQty;
    item.refundAmount = roundToPaise((item.refundAmount || 0) + refundAmount);
    item.itemStatus = item.returnedQuantity >= item.quantity ? "Returned" : "Partially Returned";
    item.refundStatus = "Refunded";
    item.refundedAt = new Date();
    item.refundTransactionId = refundTransactionId;
    item.requestedReturnQuantity = 0;

    order.totalRefundedAmount = roundToPaise((order.totalRefundedAmount || 0) + refundAmount);
    order.hasReturns = true;

    await order.save();

    return res.status(200).json({
      success: true,
      message: `Return approved for ${returnQty} unit(s) of "${item.name}". Refund of ₹${refundAmount.toLocaleString("en-IN")} authorized.`,
      order: normalizeOrderWithAllocations(order.toObject ? order.toObject() : order),
      refund: {
        refundAmount,
        returnedQuantity: returnQty,
        refundTransactionId,
      },
    });
  } catch (error) {
    console.error("Approve item return error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process return approval.",
    });
  }
};

// ========================================================
// 12. ADMIN: REJECT ITEM RETURN REQUEST
// ========================================================
const rejectItemReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason = "Return request declined after inspection." } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: "Invalid order or item identifier." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Fragrance item not found in order." });
    }

    item.itemStatus = (item.returnedQuantity || 0) > 0 ? "Partially Returned" : "Active";
    item.refundStatus = "Rejected";
    item.returnReason = String(reason || "Return request declined").trim();
    item.requestedReturnQuantity = 0;

    await order.save();

    return res.status(200).json({
      success: true,
      message: `Return request for "${item.name}" has been rejected.`,
      order: normalizeOrderWithAllocations(order.toObject ? order.toObject() : order),
    });
  } catch (error) {
    console.error("Reject item return error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process return rejection.",
    });
  }
};

// ========================================================
// 13. ADMIN: GET SINGLE ORDER DETAILS FOR INSPECTION
// ========================================================
const getAdminOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID." });
    }

    const order = await Order.findById(orderId).populate("user", "name email phone");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const normalized = normalizeOrderWithAllocations(order.toObject ? order.toObject() : order);
    return res.status(200).json({
      success: true,
      order: normalized,
    });
  } catch (error) {
    console.error("Get admin order details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve order details.",
    });
  }
};

export {
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
  getAdminOrderDetails,
};

export default {
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
  getAdminOrderDetails,
};


