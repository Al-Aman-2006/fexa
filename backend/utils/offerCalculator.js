import Offer from "../models/offer.model.js";

/**
 * Standard monetary rounding helper for INR (paise precision)
 */
export const roundToPaise = (num) => {
  const val = Number(num);
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

/**
 * Fetch all currently active, valid offers from MongoDB.
 * Ensures:
 * - isActive: true
 * - isArchived: false
 * - startDate <= now
 * - endDate >= now
 */
export const getActiveValidOffers = async (now = new Date()) => {
  const currentTime = new Date(now);
  const offers = await Offer.find({
    isActive: true,
    isArchived: false,
    startDate: { $lte: currentTime },
    endDate: { $gte: currentTime },
  }).sort({ priority: -1, discountValue: -1, createdAt: -1 });

  return offers;
};

/**
 * Determines whether an offer is eligible for a given product and category.
 */
export const isOfferApplicableToProduct = (offer, product) => {
  if (!offer || !product) return false;

  const prodIdStr = (product._id || product.id || product.productId)?.toString();
  const prodCategory = product.category;

  if (offer.scope === "all") {
    return true;
  }

  if (offer.scope === "category") {
    return (
      Boolean(prodCategory) &&
      Boolean(offer.category) &&
      prodCategory.trim().toLowerCase() === offer.category.trim().toLowerCase()
    );
  }

  if (offer.scope === "product") {
    const offerTargetId = (offer.productId?._id || offer.productId)?.toString();
    return Boolean(prodIdStr) && prodIdStr === offerTargetId;
  }

  if (offer.scope === "products") {
    if (!Array.isArray(offer.productIds) || offer.productIds.length === 0) {
      return false;
    }
    return offer.productIds.some((pId) => {
      const idStr = (pId?._id || pId)?.toString();
      return idStr === prodIdStr;
    });
  }

  return false;
};

/**
 * Calculates discount details for a specific base price against an offer.
 */
export const calculateOfferDiscountForPrice = (offer, basePrice) => {
  const original = roundToPaise(basePrice);
  if (original <= 0 || !offer) {
    return {
      discountAmount: 0,
      discountPercentage: 0,
      offerPrice: original,
      originalPrice: original,
    };
  }

  let discountAmount = 0;
  let discountPercentage = 0;

  if (offer.discountType === "Percentage") {
    discountPercentage = Number(offer.discountValue);
    let rawDiscount = (original * discountPercentage) / 100;
    if (offer.maxDiscount !== null && offer.maxDiscount !== undefined && offer.maxDiscount > 0) {
      rawDiscount = Math.min(rawDiscount, Number(offer.maxDiscount));
    }
    discountAmount = roundToPaise(rawDiscount);
  } else if (offer.discountType === "Fixed") {
    const fixedAmount = Number(offer.discountValue);
    let rawDiscount = Math.min(fixedAmount, original);
    discountAmount = roundToPaise(rawDiscount);
    discountPercentage = original > 0 ? Math.round((discountAmount / original) * 100) : 0;
  }

  // Ensure discount does not exceed the item price
  discountAmount = Math.min(discountAmount, original);
  const offerPrice = roundToPaise(Math.max(0, original - discountAmount));

  return {
    discountAmount,
    discountPercentage,
    offerPrice,
    originalPrice: original,
  };
};

/**
 * Deterministically resolves the single best applicable offer for a product variant.
 * If multiple active offers match (e.g. All Products 10%, Men 20%, Velvet Oud 30%),
 * this selects the one offering the highest valid discount amount (best deal for customer).
 *
 * @param {Object} product - Product record or { _id, category, ... }
 * @param {Array} activeOffers - Array of active Offer documents
 * @param {number} basePrice - Original selling price for the variant
 * @returns {Object} { offer, discountAmount, discountPercentage, offerPrice, originalPrice }
 */
export const findBestOfferForProduct = (product, activeOffers = [], basePrice = 0) => {
  const original = roundToPaise(basePrice);
  if (!activeOffers || activeOffers.length === 0 || original <= 0) {
    return {
      offer: null,
      discountAmount: 0,
      discountPercentage: 0,
      offerPrice: original,
      originalPrice: original,
    };
  }

  const matchingOffers = activeOffers.filter((off) => isOfferApplicableToProduct(off, product));

  if (matchingOffers.length === 0) {
    return {
      offer: null,
      discountAmount: 0,
      discountPercentage: 0,
      offerPrice: original,
      originalPrice: original,
    };
  }

  // Evaluate candidate discounts for each matching offer
  const evaluated = matchingOffers.map((offer) => {
    const calc = calculateOfferDiscountForPrice(offer, original);
    return {
      offer,
      ...calc,
      priority: Number(offer.priority || 0),
      createdAt: offer.createdAt ? new Date(offer.createdAt).getTime() : 0,
    };
  });

  // Sort deterministically:
  // 1. Highest discount amount
  // 2. Highest priority
  // 3. Newest offer
  evaluated.sort((a, b) => {
    if (b.discountAmount !== a.discountAmount) {
      return b.discountAmount - a.discountAmount;
    }
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return b.createdAt - a.createdAt;
  });

  const best = evaluated[0];

  return {
    offer: best.discountAmount > 0 ? best.offer : null,
    discountAmount: best.discountAmount,
    discountPercentage: best.discountPercentage,
    offerPrice: best.offerPrice,
    originalPrice: original,
  };
};

/**
 * Augments a product object with variant-level and product-level offer pricing.
 * Does NOT modify any MongoDB records.
 */
export const applyOffersToProduct = (productDoc, activeOffers = []) => {
  if (!productDoc) return null;

  // Clone plain object if Mongoose document
  const product = productDoc.toObject ? productDoc.toObject() : { ...productDoc };

  let bestProductOffer = null;
  let highestDiscountPct = 0;

  // Process variants if present
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    product.variants = product.variants.map((v) => {
      const variantObj = v.toObject ? v.toObject() : { ...v };
      const originalSellingPrice = roundToPaise(variantObj.sellingPrice);
      const { offer, discountAmount, discountPercentage, offerPrice } =
        findBestOfferForProduct(product, activeOffers, originalSellingPrice);

      if (offer && discountPercentage > highestDiscountPct) {
        highestDiscountPct = discountPercentage;
        bestProductOffer = offer;
      }

      return {
        ...variantObj,
        originalSellingPrice,
        offerPrice,
        offerDiscount: discountAmount,
        offerDiscountPercentage: discountPercentage,
        appliedOffer: offer
          ? {
              _id: offer._id,
              name: offer.name,
              discountType: offer.discountType,
              discountValue: offer.discountValue,
              scope: offer.scope,
            }
          : null,
      };
    });

    // Determine representative starting price after offers
    const purchasable = product.variants.filter((v) => v.isAvailable !== false);
    const inStock = purchasable.filter((v) => Number(v.stock) > 0);
    const pool = inStock.length > 0 ? inStock : purchasable.length > 0 ? purchasable : product.variants;

    if (pool.length > 0) {
      const offerPrices = pool.map((v) => v.offerPrice);
      const originalPrices = pool.map((v) => v.originalSellingPrice);
      product.effectiveOfferPrice = Math.min(...offerPrices);
      product.effectiveOriginalPrice = Math.min(...originalPrices);
    }
  } else {
    // Single-price fallback
    const originalSellingPrice = roundToPaise(product.price);
    const { offer, discountAmount, discountPercentage, offerPrice } =
      findBestOfferForProduct(product, activeOffers, originalSellingPrice);

    if (offer) {
      bestProductOffer = offer;
      highestDiscountPct = discountPercentage;
    }

    product.originalSellingPrice = originalSellingPrice;
    product.offerPrice = offerPrice;
    product.effectiveOfferPrice = offerPrice;
    product.effectiveOriginalPrice = originalSellingPrice;
    product.offerDiscount = discountAmount;
    product.offerDiscountPercentage = discountPercentage;
  }

  // Attach overarching offer summary for badges and UI
  product.appliedOffer = bestProductOffer
    ? {
        _id: bestProductOffer._id,
        name: bestProductOffer.name,
        discountType: bestProductOffer.discountType,
        discountValue: bestProductOffer.discountValue,
        scope: bestProductOffer.scope,
        discountPercentage: highestDiscountPct,
      }
    : null;

  return product;
};
