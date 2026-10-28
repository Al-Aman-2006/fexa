import mongoose from "mongoose";
import Offer from "../models/offer.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";
import Category from "../models/category.model.js";

/**
 * GET ADMIN OFFERS
 * Supports search, status filter, scope filter, pagination, and real-time statistics.
 */
export const getAdminOffers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const search = req.query.search ? req.query.search.trim() : "";
    const statusFilter = req.query.status ? req.query.status.trim() : "All";
    const scopeFilter = req.query.scope ? req.query.scope.trim() : "All";

    const now = new Date();

    // Query filter builder - exclude permanently archived offers from regular listing
    const query = { isArchived: false };

    // Search by offer name or description
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(safeSearch, "i");
      query.$or = [{ name: searchRegex }, { description: searchRegex }];
    }

    // Filter by Scope
    if (scopeFilter && scopeFilter !== "All") {
      query.scope = scopeFilter.toLowerCase();
    }

    // Filter by Status (All, Active, Inactive, Expired, Upcoming)
    if (statusFilter === "Active") {
      query.isActive = true;
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
    } else if (statusFilter === "Inactive") {
      query.isActive = false;
    } else if (statusFilter === "Expired") {
      query.endDate = { $lt: now };
    } else if (statusFilter === "Upcoming") {
      query.startDate = { $gt: now };
    }

    const [totalMatching, offers, allOffersForStats, orderStatsAggregate] = await Promise.all([
      Offer.countDocuments(query),
      Offer.find(query)
        .populate("productId", "name brand category price images status variants")
        .populate("productIds", "name brand category price images status variants")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      // Stats count across un-archived offers
      Offer.find({ isArchived: false }).select("isActive startDate endDate scope"),
      // Order statistics tracking offer usage
      Order.aggregate([
        {
          $match: {
            paymentStatus: { $in: ["Paid", "Pending"] },
            orderStatus: { $ne: "Cancelled" },
          },
        },
        { $unwind: "$items" },
        {
          $match: {
            "items.offerDiscount": { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalOrdersWithOffers: { $addToSet: "$_id" },
            totalSavingsGranted: {
              $sum: { $multiply: ["$items.offerDiscount", "$items.quantity"] },
            },
          },
        },
      ]),
    ]);

    // Calculate aggregated offer counts
    let activeCount = 0;
    let expiredCount = 0;
    let upcomingCount = 0;
    let inactiveCount = 0;

    allOffersForStats.forEach((off) => {
      const start = new Date(off.startDate).getTime();
      const end = new Date(off.endDate).getTime();
      const current = now.getTime();

      if (!off.isActive) {
        inactiveCount++;
      }
      if (end < current) {
        expiredCount++;
      } else if (start > current) {
        upcomingCount++;
      } else if (off.isActive) {
        activeCount++;
      }
    });

    const totalOrdersWithOffer =
      orderStatsAggregate.length > 0 && orderStatsAggregate[0].totalOrdersWithOffers
        ? orderStatsAggregate[0].totalOrdersWithOffers.length
        : 0;

    const totalOfferSavings =
      orderStatsAggregate.length > 0 && orderStatsAggregate[0].totalSavingsGranted
        ? Math.round(orderStatsAggregate[0].totalSavingsGranted)
        : 0;

    return res.status(200).json({
      success: true,
      offers,
      pagination: {
        page,
        limit,
        totalOffers: totalMatching,
        totalPages: Math.ceil(totalMatching / limit) || 1,
      },
      stats: {
        totalOffers: allOffersForStats.length,
        activeOffers: activeCount,
        expiredOffers: expiredCount,
        upcomingOffers: upcomingCount,
        inactiveOffers: inactiveCount,
        totalOrdersWithOffer,
        totalOfferSavings,
      },
    });
  } catch (error) {
    console.error("Get admin offers error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve offer list. Please try again.",
    });
  }
};

/**
 * GET SINGLE OFFER BY ID
 */
export const getOfferById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer identifier",
      });
    }

    const offer = await Offer.findById(id)
      .populate("productId", "name brand category price images status variants")
      .populate("productIds", "name brand category price images status variants");

    if (!offer || offer.isArchived) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    return res.status(200).json({
      success: true,
      offer,
    });
  } catch (error) {
    console.error("Get offer by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load offer details",
    });
  }
};

/**
 * VALIDATE OFFER PAYLOAD (COMMON FOR CREATE & UPDATE)
 */
export const validateOfferInput = async (data, isUpdate = false, existingOffer = null) => {
  const errors = {};

  // 1. Offer Name
  if (!isUpdate || data.name !== undefined) {
    if (data.name === undefined || data.name === null || typeof data.name !== "string" || !data.name.trim()) {
      errors.name = "Offer name is required.";
    } else {
      const cleanName = data.name.trim();
      if (cleanName.length < 3) {
        errors.name = "Offer name must be at least 3 characters.";
      } else if (cleanName.length > 120) {
        errors.name = "Offer name cannot exceed 120 characters.";
      } else if (/^\d+$/.test(cleanName)) {
        errors.name = "Offer name cannot consist entirely of numbers.";
      } else if (!/[a-zA-Z]/.test(cleanName)) {
        errors.name = "Offer name must contain at least one letter.";
      }
    }
  }

  // 2. Description (Optional)
  if (data.description !== undefined && data.description !== null && data.description !== "") {
    if (typeof data.description !== "string") {
      errors.description = "Description must be valid text.";
    } else if (data.description.trim().length > 300) {
      errors.description = "Description cannot exceed 300 characters.";
    }
  }

  // 3. Discount Type
  const targetDiscountType =
    data.discountType !== undefined
      ? data.discountType
      : existingOffer
      ? existingOffer.discountType
      : "Percentage";

  if (!["Percentage", "Fixed"].includes(targetDiscountType)) {
    errors.discountType = "Invalid discount type. Supported types are Percentage or Fixed.";
  }

  // 4. Discount Value
  if (!isUpdate || data.discountValue !== undefined) {
    if (data.discountValue === undefined || data.discountValue === null || data.discountValue === "") {
      errors.discountValue = "Discount value is required.";
    } else {
      const rawVal = String(data.discountValue).trim();
      const numVal = Number(rawVal);
      if (isNaN(numVal) || !Number.isFinite(numVal) || numVal <= 0) {
        errors.discountValue = "Discount value must be a valid positive number.";
      } else if (!/^\d+(\.\d{1,2})?$/.test(rawVal)) {
        errors.discountValue = "Discount value cannot have more than 2 decimal places.";
      } else if (targetDiscountType === "Percentage" && (numVal < 1 || numVal > 100)) {
        errors.discountValue = "Discount percentage must be between 1% and 100%.";
      }
    }
  }

  // 5. Scope & Scope Targets
  const targetScope =
    data.scope !== undefined ? data.scope : existingOffer ? existingOffer.scope : "all";

  if (!["all", "category", "product", "products"].includes(targetScope)) {
    errors.scope = "Please select a valid offer scope (All, Category, Product, or Selected Products).";
  } else if (targetScope === "category") {
    const cat = data.category !== undefined ? data.category : existingOffer ? existingOffer.category : null;
    if (!cat || !["Men", "Women", "Unisex"].includes(cat)) {
      errors.category = "Please select a valid category (Men, Women, or Unisex).";
    }
  } else if (targetScope === "product") {
    const pId = data.productId !== undefined ? data.productId : existingOffer ? existingOffer.productId : null;
    if (!pId || !mongoose.Types.ObjectId.isValid(pId)) {
      errors.productId = "Please select a valid product.";
    } else {
      const existingProduct = await Product.findById(pId).select("_id name");
      if (!existingProduct) {
        errors.productId = "The selected product does not exist in the catalogue.";
      }
    }
  } else if (targetScope === "products") {
    const pIds = data.productIds !== undefined ? data.productIds : existingOffer ? existingOffer.productIds : [];
    if (!Array.isArray(pIds) || pIds.length === 0) {
      errors.productIds = "Please select at least one product for this offer.";
    } else {
      const validIds = pIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length === 0) {
        errors.productIds = "Please select valid products.";
      } else {
        const uniqueIds = [...new Set(validIds.map((id) => id.toString()))];
        const count = await Product.countDocuments({ _id: { $in: uniqueIds } });
        if (count === 0) {
          errors.productIds = "None of the selected products could be found in the catalogue.";
        } else if (count < uniqueIds.length) {
          errors.productIds = "One or more selected products no longer exist in the catalogue.";
        }
      }
    }
  }

  // 6. Dates
  let startMs = null;
  let endMs = null;

  if (!isUpdate || data.startDate !== undefined) {
    if (!data.startDate) {
      errors.startDate = "Start date and time is required.";
    } else {
      const s = new Date(data.startDate);
      if (isNaN(s.getTime())) {
        errors.startDate = "Please enter a valid start date and time.";
      } else {
        startMs = s.getTime();
      }
    }
  } else if (existingOffer) {
    startMs = new Date(existingOffer.startDate).getTime();
  }

  if (!isUpdate || data.endDate !== undefined) {
    if (!data.endDate) {
      errors.endDate = "Expiration date and time is required.";
    } else {
      const e = new Date(data.endDate);
      if (isNaN(e.getTime())) {
        errors.endDate = "Please enter a valid expiration date and time.";
      } else {
        endMs = e.getTime();
      }
    }
  } else if (existingOffer) {
    endMs = new Date(existingOffer.endDate).getTime();
  }

  if (startMs !== null && endMs !== null) {
    if (endMs <= startMs) {
      errors.endDate = "Expiry date must be later than the start date.";
    }
  }

  // 7. Optional caps & numeric constraints
  if (data.minPurchaseAmount !== undefined && data.minPurchaseAmount !== null && data.minPurchaseAmount !== "") {
    const rawMin = String(data.minPurchaseAmount).trim();
    const numMin = Number(rawMin);
    if (isNaN(numMin) || !Number.isFinite(numMin) || numMin < 0) {
      errors.minPurchaseAmount = "Minimum purchase amount must be 0 or a positive number.";
    } else if (!/^\d+(\.\d{1,2})?$/.test(rawMin)) {
      errors.minPurchaseAmount = "Minimum purchase amount cannot have more than 2 decimal places.";
    }
  }

  if (data.maxDiscount !== undefined && data.maxDiscount !== null && data.maxDiscount !== "") {
    const rawMax = String(data.maxDiscount).trim();
    const numMax = Number(rawMax);
    if (isNaN(numMax) || !Number.isFinite(numMax) || numMax <= 0) {
      errors.maxDiscount = "Maximum discount cap must be a positive number greater than 0.";
    } else if (!/^\d+(\.\d{1,2})?$/.test(rawMax)) {
      errors.maxDiscount = "Maximum discount cap cannot have more than 2 decimal places.";
    }
  }

  return errors;
};

/**
 * CREATE NEW OFFER
 */
export const createOffer = async (req, res) => {
  try {
    const validationErrors = await validateOfferInput(req.body, false);
    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: Object.values(validationErrors)[0] || "Please correct the highlighted fields before saving.",
        errors: validationErrors,
      });
    }

    const {
      name,
      description = "",
      discountType = "Percentage",
      discountValue,
      scope = "all",
      category = null,
      productId = null,
      productIds = [],
      startDate,
      endDate,
      isActive = true,
      minPurchaseAmount = 0,
      maxDiscount = null,
      priority = 0,
    } = req.body;

    const cleanName = name.trim();
    const cleanDescription = description ? description.trim() : "";
    const cleanDiscountType = discountType === "Fixed" ? "Fixed" : "Percentage";
    const numDiscountValue = Number(discountValue);

    let cleanCategory = null;
    let cleanProductId = null;
    let cleanProductIds = [];

    if (scope === "category") {
      cleanCategory = category;
    } else if (scope === "product") {
      cleanProductId = productId;
    } else if (scope === "products") {
      cleanProductIds = [...new Set(productIds.map((id) => id.toString()))];
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = new Date(endDate);

    const cleanMinPurchase =
      minPurchaseAmount !== undefined && minPurchaseAmount !== null && minPurchaseAmount !== ""
        ? Math.max(0, Number(minPurchaseAmount))
        : 0;

    const cleanMaxDiscount =
      maxDiscount !== undefined && maxDiscount !== null && maxDiscount !== ""
        ? Math.max(0, Number(maxDiscount))
        : null;

    // Create Offer Document
    const newOffer = new Offer({
      name: cleanName,
      description: cleanDescription,
      discountType: cleanDiscountType,
      discountValue: numDiscountValue,
      scope,
      category: cleanCategory,
      productId: cleanProductId,
      productIds: cleanProductIds,
      startDate: start,
      endDate: end,
      isActive: Boolean(isActive),
      minPurchaseAmount: cleanMinPurchase,
      maxDiscount: cleanMaxDiscount,
      priority: Number(priority) || 0,
    });

    await newOffer.save();

    const populatedOffer = await Offer.findById(newOffer._id)
      .populate("productId", "name brand category price images status variants")
      .populate("productIds", "name brand category price images status variants");

    return res.status(201).json({
      success: true,
      message: "Offer created successfully",
      offer: populatedOffer,
    });
  } catch (error) {
    console.error("Create offer error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create offer. Please try again.",
    });
  }
};

/**
 * UPDATE EXISTING OFFER
 * Completely replaces scope targets to avoid retaining stale categories or products.
 */
export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer identifier",
      });
    }

    const offer = await Offer.findById(id);
    if (!offer || offer.isArchived) {
      return res.status(404).json({
        success: false,
        message: "Offer not found or has been archived",
      });
    }

    const validationErrors = await validateOfferInput(req.body, true, offer);
    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: Object.values(validationErrors)[0] || "Please correct the highlighted fields before saving.",
        errors: validationErrors,
      });
    }

    const {
      name,
      description,
      discountType,
      discountValue,
      scope,
      category,
      productId,
      productIds,
      startDate,
      endDate,
      isActive,
      minPurchaseAmount,
      maxDiscount,
      priority,
    } = req.body;

    // 1. Name & Desc
    if (name !== undefined) {
      offer.name = name.trim();
    }
    if (description !== undefined) {
      offer.description = typeof description === "string" ? description.trim() : "";
    }

    // 2. Discount Type & Value
    if (discountType !== undefined) {
      offer.discountType = discountType === "Fixed" ? "Fixed" : "Percentage";
    }
    if (discountValue !== undefined) {
      offer.discountValue = Number(discountValue);
    }

    // 3. Scope Replacement
    if (scope !== undefined) {
      offer.scope = scope;
    }

    if (offer.scope === "all") {
      offer.category = null;
      offer.productId = null;
      offer.productIds = [];
    } else if (offer.scope === "category") {
      offer.category = category !== undefined ? category : offer.category;
      offer.productId = null;
      offer.productIds = [];
    } else if (offer.scope === "product") {
      offer.productId = productId !== undefined ? productId : offer.productId;
      offer.category = null;
      offer.productIds = [];
    } else if (offer.scope === "products") {
      const pIds = productIds !== undefined ? productIds : offer.productIds;
      const valid = Array.isArray(pIds) ? pIds.filter((p) => mongoose.Types.ObjectId.isValid(p)) : [];
      offer.productIds = [...new Set(valid.map((id) => id.toString()))];
      offer.category = null;
      offer.productId = null;
    }

    // 4. Dates
    if (startDate !== undefined) {
      offer.startDate = new Date(startDate);
    }
    if (endDate !== undefined) {
      offer.endDate = new Date(endDate);
    }

    // 5. Active & Numeric settings
    if (isActive !== undefined) {
      offer.isActive = Boolean(isActive);
    }
    if (minPurchaseAmount !== undefined) {
      offer.minPurchaseAmount =
        minPurchaseAmount !== null && minPurchaseAmount !== "" ? Math.max(0, Number(minPurchaseAmount)) : 0;
    }
    if (maxDiscount !== undefined) {
      offer.maxDiscount =
        maxDiscount !== null && maxDiscount !== "" ? Math.max(0, Number(maxDiscount)) : null;
    }
    if (priority !== undefined) {
      offer.priority = Number(priority) || 0;
    }

    await offer.save();

    const updated = await Offer.findById(offer._id)
      .populate("productId", "name brand category price images status variants")
      .populate("productIds", "name brand category price images status variants");

    return res.status(200).json({
      success: true,
      message: "Offer updated successfully",
      offer: updated,
    });
  } catch (error) {
    console.error("Update offer error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update offer. Please try again.",
    });
  }
};

/**
 * TOGGLE OFFER STATUS (Active / Inactive)
 */
export const toggleOfferStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer identifier",
      });
    }

    const offer = await Offer.findById(id);
    if (!offer || offer.isArchived) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    return res.status(200).json({
      success: true,
      message: `Offer "${offer.name}" is now ${offer.isActive ? "Active" : "Inactive"}`,
      isActive: offer.isActive,
      offer,
    });
  } catch (error) {
    console.error("Toggle offer status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update offer status",
    });
  }
};

/**
 * DELETE / ARCHIVE OFFER SAFELY
 * Preserves historical order integrity by setting isArchived: true and isActive: false.
 */
export const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer identifier",
      });
    }

    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    // Check if referenced in historical orders
    const historicalOrderCount = await Order.countDocuments({
      "items.appliedOffer": offer._id,
    });

    if (historicalOrderCount > 0) {
      // Historical references exist: Archive safely to preserve historical order snapshots
      offer.isArchived = true;
      offer.isActive = false;
      await offer.save();

      return res.status(200).json({
        success: true,
        message: `Offer archived safely. It has been used in ${historicalOrderCount} past orders and will no longer apply to new purchases.`,
      });
    }

    // If no past orders used this offer, also archive safely
    offer.isArchived = true;
    offer.isActive = false;
    await offer.save();

    return res.status(200).json({
      success: true,
      message: "Offer removed successfully",
    });
  } catch (error) {
    console.error("Delete offer error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete offer",
    });
  }
};

/**
 * SEARCH ADMIN PRODUCTS FOR SCOPE SELECTION
 * Allows Admin to search and select products for "Specific Product" or "Selected Products" scope.
 */
export const searchAdminOfferProducts = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : "";
    const category = req.query.category ? req.query.category.trim() : "";

    const query = {};

    if (category && ["Men", "Women", "Unisex"].includes(category)) {
      query.category = category;
    }

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(safeSearch, "i");
      query.$or = [{ name: searchRegex }, { brand: searchRegex }, { slug: searchRegex }];
    }

    const products = await Product.find(query)
      .select("_id name brand category price compareAtPrice stock images status variants")
      .sort({ createdAt: -1 })
      .limit(30);

    return res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Search admin offer products error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search products",
    });
  }
};
