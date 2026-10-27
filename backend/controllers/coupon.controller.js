import mongoose from "mongoose";
import Coupon from "../models/coupon.model.js";
import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import { calculateItemCouponAllocations } from "../utils/couponAllocation.js";

// ========================================================
// HELPER: Calculate live cart merchandise subtotal from DB
// ========================================================
const calculateLiveCartSubtotal = async (userId) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart || !cart.items || cart.items.length === 0) {
    return { error: "Your shopping bag is empty.", subtotal: 0, items: [] };
  }

  let subtotal = 0;
  const verifiedItems = [];

  for (const item of cart.items) {
    const prodId = item.product;
    const product = await Product.findById(prodId);
    if (!product || product.status === "Inactive") continue;

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

    if (!variant || variant.isAvailable === false || variant.stock <= 0) continue;

    const qty = Math.min(Math.max(1, parseInt(item.quantity, 10) || 1), 5);
    const price = Number(variant.sellingPrice) || Number(variant.price) || Number(item.unitPrice) || 0;
    subtotal += price * qty;

    verifiedItems.push({
      product: product._id,
      variantId: variant._id,
      name: product.name,
      volumeMl: variant.volumeMl,
      quantity: qty,
      unitPrice: price,
      lineTotal: price * qty,
    });
  }

  if (verifiedItems.length === 0) {
    return { error: "No available in-stock fragrances in your shopping bag.", subtotal: 0, items: [] };
  }

  return { subtotal, items: verifiedItems };
};

// ========================================================
// 1. ADMIN: CREATE COUPON
// ========================================================
const createCoupon = async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      discountType = "Percentage",
      discountPercentage,
      minOrderAmount = 0,
      maxDiscount = null,
      startDate,
      expiryDate,
      isActive = true,
      usageLimit = null,
      perUserLimit = 1,
    } = req.body;

    // 1. Validate Code
    if (!code || typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required.",
      });
    }

    const normalizedCode = code.trim().toUpperCase();
    const codeRegex = /^[A-Z0-9_-]{3,30}$/;
    if (!codeRegex.test(normalizedCode)) {
      return res.status(400).json({
        success: false,
        message:
          "Coupon code must be 3-30 characters containing only letters, numbers, hyphens, and underscores.",
      });
    }

    // Check uniqueness (case-insensitive)
    const existing = await Coupon.findOne({
      code: normalizedCode,
      isArchived: false,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A coupon with code "${normalizedCode}" already exists.`,
      });
    }

    // 2. Validate Discount Percentage
    const parsedPct = Number(discountPercentage);
    if (!Number.isFinite(parsedPct) || isNaN(parsedPct) || parsedPct < 1 || parsedPct > 100) {
      return res.status(400).json({
        success: false,
        message: "Discount percentage must be a valid number between 1% and 100%.",
      });
    }

    // 3. Validate Minimum Order Amount
    const parsedMinOrder = Number(minOrderAmount) || 0;
    if (parsedMinOrder < 0 || isNaN(parsedMinOrder)) {
      return res.status(400).json({
        success: false,
        message: "Minimum order amount cannot be negative.",
      });
    }

    // 4. Validate Max Discount
    let parsedMaxDiscount = null;
    if (maxDiscount !== undefined && maxDiscount !== null && maxDiscount !== "") {
      const parsedMax = Number(maxDiscount);
      if (isNaN(parsedMax) || parsedMax <= 0) {
        return res.status(400).json({
          success: false,
          message: "Maximum discount amount must be a positive number.",
        });
      }
      parsedMaxDiscount = parsedMax;
    }

    // 5. Validate Dates
    if (!startDate || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: "Both start date and expiry date are required.",
      });
    }

    const start = new Date(startDate);
    const expiry = new Date(expiryDate);

    if (isNaN(start.getTime()) || isNaN(expiry.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start or expiry date format.",
      });
    }

    if (start.getTime() >= expiry.getTime()) {
      return res.status(400).json({
        success: false,
        message: "Expiry date and time must be after the start date and time.",
      });
    }

    // 6. Validate Usage Limits
    let parsedUsageLimit = null;
    if (usageLimit !== undefined && usageLimit !== null && usageLimit !== "") {
      const parsedLimit = parseInt(usageLimit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return res.status(400).json({
          success: false,
          message: "Total usage limit must be at least 1.",
        });
      }
      parsedUsageLimit = parsedLimit;
    }

    let parsedPerUser = 1;
    if (perUserLimit !== undefined && perUserLimit !== null && perUserLimit !== "") {
      const parsedPULimit = parseInt(perUserLimit, 10);
      if (isNaN(parsedPULimit) || parsedPULimit < 1) {
        return res.status(400).json({
          success: false,
          message: "Per-user usage limit must be at least 1.",
        });
      }
      parsedPerUser = parsedPULimit;
    }

    const coupon = await Coupon.create({
      code: normalizedCode,
      name: (name || "").trim(),
      description: (description || "").trim(),
      discountType,
      discountPercentage: parsedPct,
      minOrderAmount: parsedMinOrder,
      maxDiscount: parsedMaxDiscount,
      startDate: start,
      expiryDate: expiry,
      isActive: Boolean(isActive),
      usageLimit: parsedUsageLimit,
      perUserLimit: parsedPerUser,
    });

    return res.status(201).json({
      success: true,
      message: `Coupon "${coupon.code}" created successfully.`,
      coupon,
    });
  } catch (error) {
    console.error("Create coupon error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A coupon with this code already exists.",
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create coupon.",
    });
  }
};

// ========================================================
// 2. ADMIN: GET ALL COUPONS (Paginated, Search, Metrics)
// ========================================================
const getAdminCoupons = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const search = (req.query.search || "").trim();
    const status = (req.query.status || "All").trim(); // "All" | "Active" | "Inactive" | "Expired"

    const filter = { isArchived: false };
    const now = new Date();

    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (status === "Active") {
      filter.isActive = true;
      filter.startDate = { $lte: now };
      filter.expiryDate = { $gte: now };
    } else if (status === "Inactive") {
      filter.isActive = false;
    } else if (status === "Expired") {
      filter.expiryDate = { $lt: now };
    }

    const totalCouponsCount = await Coupon.countDocuments(filter);
    const totalPages = Math.ceil(totalCouponsCount / limit) || 1;

    const coupons = await Coupon.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Compute executive stats across all active non-archived coupons
    const allCoupons = await Coupon.find({ isArchived: false });
    const totalCoupons = allCoupons.length;
    const activeCoupons = allCoupons.filter(
      (c) => c.isActive && new Date(c.startDate) <= now && new Date(c.expiryDate) >= now
    ).length;
    const expiredCoupons = allCoupons.filter((c) => new Date(c.expiryDate) < now).length;
    const totalRedemptions = allCoupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);

    return res.status(200).json({
      success: true,
      coupons,
      pagination: {
        page,
        limit,
        totalCoupons: totalCouponsCount,
        totalPages,
      },
      stats: {
        totalCoupons,
        activeCoupons,
        expiredCoupons,
        totalRedemptions,
      },
    });
  } catch (error) {
    console.error("Get admin coupons error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve coupons.",
    });
  }
};

// ========================================================
// 3. ADMIN: GET COUPON BY ID
// ========================================================
const getCouponById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID.",
      });
    }

    const coupon = await Coupon.findOne({ _id: id, isArchived: false })
      .populate("userRedemptions.user", "name email phone")
      .populate("userRedemptions.orderId", "orderNumber totalAmount paymentStatus");

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found.",
      });
    }

    return res.status(200).json({
      success: true,
      coupon,
    });
  } catch (error) {
    console.error("Get coupon by id error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve coupon details.",
    });
  }
};

// ========================================================
// 4. ADMIN: UPDATE COUPON
// ========================================================
const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID.",
      });
    }

    const coupon = await Coupon.findOne({ _id: id, isArchived: false });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found.",
      });
    }

    const {
      code,
      name,
      description,
      discountPercentage,
      minOrderAmount,
      maxDiscount,
      startDate,
      expiryDate,
      isActive,
      usageLimit,
      perUserLimit,
    } = req.body;

    // Validate Code if changing
    if (code !== undefined) {
      const normalizedCode = code.trim().toUpperCase();
      const codeRegex = /^[A-Z0-9_-]{3,30}$/;
      if (!codeRegex.test(normalizedCode)) {
        return res.status(400).json({
          success: false,
          message: "Coupon code must be 3-30 characters with letters, numbers, hyphens or underscores.",
        });
      }

      if (normalizedCode !== coupon.code) {
        const duplicate = await Coupon.findOne({
          code: normalizedCode,
          _id: { $ne: coupon._id },
          isArchived: false,
        });
        if (duplicate) {
          return res.status(400).json({
            success: false,
            message: `A coupon with code "${normalizedCode}" already exists.`,
          });
        }
        coupon.code = normalizedCode;
      }
    }

    if (name !== undefined) coupon.name = (name || "").trim();
    if (description !== undefined) coupon.description = (description || "").trim();

    if (discountPercentage !== undefined) {
      const parsedPct = Number(discountPercentage);
      if (!Number.isFinite(parsedPct) || isNaN(parsedPct) || parsedPct < 1 || parsedPct > 100) {
        return res.status(400).json({
          success: false,
          message: "Discount percentage must be a valid number between 1% and 100%.",
        });
      }
      coupon.discountPercentage = parsedPct;
    }

    if (minOrderAmount !== undefined) {
      const parsedMin = Number(minOrderAmount);
      if (isNaN(parsedMin) || parsedMin < 0) {
        return res.status(400).json({
          success: false,
          message: "Minimum order amount cannot be negative.",
        });
      }
      coupon.minOrderAmount = parsedMin;
    }

    if (maxDiscount !== undefined) {
      if (maxDiscount === null || maxDiscount === "") {
        coupon.maxDiscount = null;
      } else {
        const parsedMax = Number(maxDiscount);
        if (isNaN(parsedMax) || parsedMax <= 0) {
          return res.status(400).json({
            success: false,
            message: "Maximum discount must be a positive number.",
          });
        }
        coupon.maxDiscount = parsedMax;
      }
    }

    const newStart = startDate !== undefined ? new Date(startDate) : coupon.startDate;
    const newExpiry = expiryDate !== undefined ? new Date(expiryDate) : coupon.expiryDate;

    if (isNaN(newStart.getTime()) || isNaN(newExpiry.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start or expiry date format.",
      });
    }

    if (newStart.getTime() >= newExpiry.getTime()) {
      return res.status(400).json({
        success: false,
        message: "Expiry date must be after the start date.",
      });
    }

    coupon.startDate = newStart;
    coupon.expiryDate = newExpiry;

    if (isActive !== undefined) coupon.isActive = Boolean(isActive);

    if (usageLimit !== undefined) {
      if (usageLimit === null || usageLimit === "") {
        coupon.usageLimit = null;
      } else {
        const parsedLimit = parseInt(usageLimit, 10);
        if (isNaN(parsedLimit) || parsedLimit < 1) {
          return res.status(400).json({
            success: false,
            message: "Total usage limit must be at least 1.",
          });
        }
        coupon.usageLimit = parsedLimit;
      }
    }

    if (perUserLimit !== undefined) {
      const parsedPULimit = parseInt(perUserLimit, 10);
      if (isNaN(parsedPULimit) || parsedPULimit < 1) {
        return res.status(400).json({
          success: false,
          message: "Per-user limit must be at least 1.",
        });
      }
      coupon.perUserLimit = parsedPULimit;
    }

    await coupon.save();

    return res.status(200).json({
      success: true,
      message: `Coupon "${coupon.code}" updated successfully.`,
      coupon,
    });
  } catch (error) {
    console.error("Update coupon error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update coupon.",
    });
  }
};

// ========================================================
// 5. ADMIN: TOGGLE STATUS (Activate / Deactivate)
// ========================================================
const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID.",
      });
    }

    const coupon = await Coupon.findOne({ _id: id, isArchived: false });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found.",
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    return res.status(200).json({
      success: true,
      message: `Coupon "${coupon.code}" is now ${coupon.isActive ? "active" : "inactive"}.`,
      isActive: coupon.isActive,
      coupon,
    });
  } catch (error) {
    console.error("Toggle coupon status error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update coupon status.",
    });
  }
};

// ========================================================
// 6. ADMIN: SAFE ARCHIVE / DELETE COUPON
// ========================================================
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID.",
      });
    }

    const coupon = await Coupon.findOne({ _id: id, isArchived: false });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found or already deleted.",
      });
    }

    // Soft-delete: mark isArchived so historical orders with coupon snapshot remain intact
    coupon.isArchived = true;
    coupon.isActive = false;
    await coupon.save();

    return res.status(200).json({
      success: true,
      message: `Coupon "${coupon.code}" archived successfully.`,
    });
  } catch (error) {
    console.error("Delete coupon error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete coupon.",
    });
  }
};

// ========================================================
// 7. USER: GET AVAILABLE / ELIGIBLE OFFERS
// ========================================================
const getAvailableCoupons = async (req, res) => {
  try {
    const now = new Date();
    const userId = req.user ? req.user.id : null;

    const coupons = await Coupon.find({
      isArchived: false,
      isActive: true,
      startDate: { $lte: now },
      expiryDate: { $gte: now },
      $expr: {
        $or: [
          { $eq: ["$usageLimit", null] },
          { $lt: ["$usedCount", "$usageLimit"] },
        ],
      },
    }).sort({ discountPercentage: -1 });

    const customerCoupons = coupons.map((c) => {
      let isExhaustedForUser = false;
      if (userId && c.perUserLimit) {
        const userCount = (c.userRedemptions || []).filter(
          (r) => r.user && r.user.toString() === userId.toString()
        ).length;
        if (userCount >= c.perUserLimit) {
          isExhaustedForUser = true;
        }
      }

      return {
        id: c._id,
        code: c.code,
        name: c.name || "Special Privilege",
        description: c.description || `Enjoy ${c.discountPercentage}% off your artisanal fragrance order.`,
        discountType: c.discountType,
        discountPercentage: c.discountPercentage,
        minOrderAmount: c.minOrderAmount,
        maxDiscount: c.maxDiscount,
        expiryDate: c.expiryDate,
        isExhaustedForUser,
      };
    });

    return res.status(200).json({
      success: true,
      coupons: customerCoupons,
    });
  } catch (error) {
    console.error("Get available coupons error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load offers.",
    });
  }
};

// ========================================================
// 8. USER: APPLY / VALIDATE COUPON FOR CHECKOUT (STRICT ONE COUPON RULE)
// ========================================================
const applyCoupon = async (req, res) => {
  try {
    const userId = req.user.id;
    let code = req.body.couponCode !== undefined ? req.body.couponCode : req.body.code;

    // Strict validation: Reject multiple coupons submitted as an array
    if (Array.isArray(code)) {
      if (code.length > 1) {
        return res.status(400).json({
          success: false,
          message: "Only one coupon can be applied per order. Combining coupons is strictly disallowed.",
        });
      }
      code = code[0];
    }

    if (!code || typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid coupon code.",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    // 1. Find coupon in DB
    const coupon = await Coupon.findOne({
      code: normalizedCode,
      isArchived: false,
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: `Invalid coupon code "${normalizedCode}".`,
      });
    }

    // 2. Compute authoritative live merchandise subtotal directly from MongoDB
    const cartCalc = await calculateLiveCartSubtotal(userId);
    if (cartCalc.error) {
      return res.status(400).json({
        success: false,
        message: cartCalc.error,
      });
    }

    const eligibleSubtotal = cartCalc.subtotal;

    // 3. Validate coupon against subtotal and user limits
    const check = coupon.validateForOrder(eligibleSubtotal, userId);
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        message: check.reason,
      });
    }

    // 4. Calculate authoritative product-level discount allocations
    const allocation = calculateItemCouponAllocations({
      items: cartCalc.items,
      coupon,
      merchandiseSubtotal: eligibleSubtotal,
    });

    const discountAmount = allocation.totalCouponDiscount;
    const shippingCost = eligibleSubtotal >= 5000 ? 0 : 250;
    const totalAmount = Math.max(0, allocation.discountedMerchandiseTotal) + shippingCost;

    return res.status(200).json({
      success: true,
      message: `Coupon ${coupon.code} applied successfully.`,
      coupon: {
        _id: coupon._id,
        id: coupon._id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discountType: coupon.discountType,
        discountPercentage: coupon.discountPercentage,
        discountAmount,
        eligibleSubtotal,
        finalTotal: totalAmount,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscount: coupon.maxDiscount,
        itemAllocations: allocation.allocatedItems,
      },
      calculation: {
        subtotal: eligibleSubtotal,
        discountAmount,
        shippingCost,
        totalAmount,
        itemAllocations: allocation.allocatedItems,
      },
    });
  } catch (error) {
    console.error("Apply coupon error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to apply coupon.",
    });
  }
};

// ========================================================
// 9. USER: REMOVE COUPON (Recalculate Checkout without discount)
// ========================================================
const removeCoupon = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartCalc = await calculateLiveCartSubtotal(userId);
    if (cartCalc.error) {
      return res.status(400).json({
        success: false,
        message: cartCalc.error,
      });
    }

    const eligibleSubtotal = cartCalc.subtotal;
    const shippingCost = eligibleSubtotal >= 5000 ? 0 : 250;
    const totalAmount = eligibleSubtotal + shippingCost;

    return res.status(200).json({
      success: true,
      message: "Coupon removed successfully.",
      calculation: {
        subtotal: eligibleSubtotal,
        discountAmount: 0,
        shippingCost,
        totalAmount,
      },
    });
  } catch (error) {
    console.error("Remove coupon error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to recalculate order totals.",
    });
  }
};

export {
  createCoupon,
  getAdminCoupons,
  getCouponById,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  getAvailableCoupons,
  applyCoupon,
  removeCoupon,
  calculateLiveCartSubtotal,
};

export default {
  createCoupon,
  getAdminCoupons,
  getCouponById,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  getAvailableCoupons,
  applyCoupon,
  removeCoupon,
  calculateLiveCartSubtotal,
};
