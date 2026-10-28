import mongoose from "mongoose";
import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import { getActiveValidOffers, findBestOfferForProduct, roundToPaise } from "../utils/offerCalculator.js";

// Format cart helper: cleans up deleted products, computes live subtotal and item count
const formatCartResponse = async (cartDoc) => {
  if (!cartDoc) {
    return {
      items: [],
      subtotal: 0,
      totalItems: 0,
      freeShippingThreshold: 5000,
      qualifiesForFreeShipping: false,
      amountForFreeShipping: 5000,
    };
  }

  // Populate product reference including variants
  await cartDoc.populate({
    path: "items.product",
    select: "_id name slug brand category price compareAtPrice stock images status variants",
  });

  // Retrieve live category activation statuses
  const allCategories = await Category.find({});
  const categoryStatusMap = { Men: true, Women: true, Unisex: true };
  allCategories.forEach((c) => {
    categoryStatusMap[c.name] = c.isActive;
  });

  // Retrieve active valid offers
  const activeOffers = await getActiveValidOffers();

  const formattedItems = [];
  const validItemsToKeep = [];
  let subtotal = 0;
  let originalSubtotal = 0;
  let totalOfferDiscount = 0;
  let totalItems = 0;
  let hasModifiedCart = false;

  for (const item of cartDoc.items) {
    // 1. If product was deleted from MongoDB by Admin, safely prune it
    if (!item.product) {
      hasModifiedCart = true;
      continue;
    }

    const prod = item.product;
    const isCategoryInactive = categoryStatusMap[prod.category] === false;
    const isInactive = prod.status === "Inactive" || isCategoryInactive;

    let livePrice = Number(prod.price) || 0;
    let liveOriginalPrice = Number(prod.compareAtPrice) || 0;
    let liveStock = Number(prod.stock) || 0;
    let volumeMl = item.volumeMl || 100;
    let isVariantOutOfStock = false;
    let variantId = item.variantId ? item.variantId.toString() : null;

    // Check variant specifics if product has variants
    if (prod.variants && prod.variants.length > 0) {
      let matchedVariant = null;
      if (item.variantId) {
        matchedVariant = prod.variants.find(
          (v) => v._id.toString() === item.variantId.toString()
        );
      }

      // If no variantId on cart item but only 1 variant exists on product, link it
      if (!matchedVariant && !item.variantId && prod.variants.length === 1) {
        matchedVariant = prod.variants[0];
        item.variantId = matchedVariant._id;
        item.volumeMl = matchedVariant.volumeMl;
        hasModifiedCart = true;
      }

      if (matchedVariant) {
        variantId = matchedVariant._id.toString();
        volumeMl = matchedVariant.volumeMl;
        livePrice = Number(matchedVariant.sellingPrice) || 0;
        liveOriginalPrice = Number(matchedVariant.originalPrice) || 0;
        liveStock = Number(matchedVariant.stock) || 0;
        const isAvailable = matchedVariant.isAvailable !== false;
        isVariantOutOfStock = liveStock === 0 || !isAvailable;
      } else if (item.variantId) {
        // Variant was removed by admin
        isVariantOutOfStock = true;
      }
    }

    const isOutOfStock =
      isVariantOutOfStock ||
      liveStock === 0 ||
      prod.status === "Out of Stock";

    const qty = Math.max(1, Number(item.quantity) || 1);

    // Calculate applicable automatic offer for this product & variant
    const originalUnitPrice = roundToPaise(livePrice);
    const bestOffer = findBestOfferForProduct(prod, activeOffers, originalUnitPrice);
    const offerPrice = bestOffer.offerPrice;
    const unitOfferDiscount = bestOffer.discountAmount;
    const lineOfferDiscount = roundToPaise(unitOfferDiscount * qty);
    const lineTotal = roundToPaise(offerPrice * qty);
    const originalLineTotal = roundToPaise(originalUnitPrice * qty);

    // If active and available, add to subtotal and active count
    if (!isInactive && !isOutOfStock) {
      subtotal += lineTotal;
      originalSubtotal += originalLineTotal;
      totalOfferDiscount += lineOfferDiscount;
      totalItems += qty;
    }

    formattedItems.push({
      _id: item._id,
      productId: prod._id,
      variantId,
      volumeMl,
      name: prod.name,
      slug: prod.slug,
      brand: prod.brand || "FEXA",
      category: prod.category,
      originalPrice: originalUnitPrice,
      price: offerPrice,
      unitPrice: offerPrice,
      offerDiscount: unitOfferDiscount,
      totalOfferDiscount: lineOfferDiscount,
      appliedOffer: bestOffer.offer
        ? {
            _id: bestOffer.offer._id,
            name: bestOffer.offer.name,
            discountType: bestOffer.offer.discountType,
            discountValue: bestOffer.offer.discountValue,
            discountPercentage: bestOffer.discountPercentage,
          }
        : null,
      compareAtPrice: liveOriginalPrice,
      images: prod.images || [],
      primaryImage: prod.images && prod.images.length > 0 ? prod.images[0] : null,
      stock: liveStock,
      quantity: qty,
      itemTotal: lineTotal,
      originalItemTotal: originalLineTotal,
      isInactive,
      isCategoryInactive,
      isOutOfStock,
      status: prod.status,
    });

    validItemsToKeep.push(item);
  }

  // If deleted products or auto-linked variants were detected, save the pruned/updated cart
  if (hasModifiedCart) {
    cartDoc.items = validItemsToKeep;
    await cartDoc.save();
  }

  const FREE_SHIPPING_THRESHOLD = 5000;
  const qualifiesForFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const amountForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return {
    _id: cartDoc._id,
    items: formattedItems,
    subtotal: roundToPaise(subtotal),
    originalSubtotal: roundToPaise(originalSubtotal),
    totalOfferDiscount: roundToPaise(totalOfferDiscount),
    totalItems,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    qualifiesForFreeShipping,
    amountForFreeShipping,
  };
};

// ========================================================
// GET USER CART
// ========================================================
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    const formatted = await formatCartResponse(cart);

    return res.status(200).json({
      success: true,
      cart: formatted,
    });
  } catch (error) {
    console.error("Get cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load your shopping bag. Please try again.",
    });
  }
};

// ========================================================
// ADD ITEM TO CART (With Variant Support)
// ========================================================
const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, variantId, quantity = 1 } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product identifier.",
      });
    }

    const requestedQty = parseInt(quantity, 10);
    if (isNaN(requestedQty) || requestedQty < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1.",
      });
    }

    if (requestedQty > 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum 5 items allowed per perfume size.",
      });
    }

    // 1. Fetch live product from MongoDB
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    // 2. Check if product and its category are active
    const categoryDoc = await Category.findOne({ name: product.category });
    if (categoryDoc && !categoryDoc.isActive) {
      return res.status(400).json({
        success: false,
        message: `The ${product.category} collection is currently unavailable.`,
      });
    }

    if (product.status === "Inactive") {
      return res.status(400).json({
        success: false,
        message: "This fragrance is currently unavailable.",
      });
    }

    // 3. Resolve variant
    let selectedVariant = null;
    if (product.variants && product.variants.length > 0) {
      if (variantId) {
        selectedVariant = product.variants.find(
          (v) => v._id.toString() === variantId.toString()
        );
        if (!selectedVariant) {
          return res.status(400).json({
            success: false,
            message: "The requested perfume size variant is invalid.",
          });
        }
      } else if (product.variants.length === 1) {
        selectedVariant = product.variants[0];
      } else {
        return res.status(400).json({
          success: false,
          message: "Please choose an available perfume size.",
        });
      }
    }

    const variantStock = selectedVariant ? selectedVariant.stock : product.stock;
    const variantAvailable = selectedVariant ? selectedVariant.isAvailable !== false : true;
    const volumeMl = selectedVariant ? selectedVariant.volumeMl : 100;
    const effectiveVariantId = selectedVariant ? selectedVariant._id : null;

    if (!variantAvailable) {
      return res.status(400).json({
        success: false,
        message: `The ${volumeMl} ml size is currently unavailable.`,
      });
    }

    if (variantStock === 0 || product.status === "Out of Stock") {
      return res.status(400).json({
        success: false,
        message: `The ${volumeMl} ml size is currently out of stock.`,
      });
    }

    // 4. Find or initialize user cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // 5. Check if matching product + variant already exists in user's cart
    const existingIndex = cart.items.findIndex((item) => {
      const matchProduct = item.product.toString() === productId.toString();
      if (!matchProduct) return false;

      if (effectiveVariantId) {
        return item.variantId && item.variantId.toString() === effectiveVariantId.toString();
      }
      return !item.variantId;
    });

    if (existingIndex > -1) {
      const currentQty = cart.items[existingIndex].quantity;
      const newTotalQty = currentQty + requestedQty;

      if (newTotalQty > 5) {
        return res.status(400).json({
          success: false,
          message: "Maximum 5 items allowed per perfume size.",
        });
      }

      if (newTotalQty > variantStock) {
        return res.status(400).json({
          success: false,
          message: `Only ${variantStock} units are currently available for ${volumeMl} ml. You already have ${currentQty} in your bag.`,
          availableStock: variantStock,
        });
      }

      cart.items[existingIndex].quantity = newTotalQty;
    } else {
      if (requestedQty > 5) {
        return res.status(400).json({
          success: false,
          message: "Maximum 5 items allowed per perfume size.",
        });
      }

      if (requestedQty > variantStock) {
        return res.status(400).json({
          success: false,
          message: `Only ${variantStock} units are currently available in ${volumeMl} ml.`,
          availableStock: variantStock,
        });
      }

      cart.items.push({
        product: productId,
        variantId: effectiveVariantId,
        volumeMl,
        quantity: requestedQty,
      });
    }

    await cart.save();

    const formatted = await formatCartResponse(cart);

    return res.status(200).json({
      success: true,
      message: `${product.name} (${volumeMl} ml) added to your shopping bag.`,
      cart: formatted,
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to add product to your bag. Please try again.",
    });
  }
};

// ========================================================
// UPDATE CART ITEM QUANTITY (Supports itemId or productId + variantId)
// ========================================================
const updateCartItemQuantity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    const { quantity, variantId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Invalid identifier.",
      });
    }

    const newQty = parseInt(quantity, 10);
    if (isNaN(newQty) || newQty < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1.",
      });
    }

    if (newQty > 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum 5 items allowed per perfume size.",
      });
    }

    // Find user's cart
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Shopping bag not found.",
      });
    }

    // Locate item by cartItem._id first, or by productId + variantId
    let item = cart.items.find(
      (it) => it._id && it._id.toString() === productId.toString()
    );

    if (!item) {
      item = cart.items.find((it) => {
        const matchesProd = it.product.toString() === productId.toString();
        if (!matchesProd) return false;
        if (variantId) {
          return it.variantId && it.variantId.toString() === variantId.toString();
        }
        return true;
      });
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Product is not in your shopping bag.",
      });
    }

    // Fetch live product and variant from MongoDB
    const liveProduct = await Product.findById(item.product);
    if (!liveProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const categoryDoc = await Category.findOne({ name: liveProduct.category });
    if (categoryDoc && !categoryDoc.isActive) {
      return res.status(400).json({
        success: false,
        message: `The ${liveProduct.category} collection is currently unavailable.`,
      });
    }

    if (liveProduct.status === "Inactive") {
      return res.status(400).json({
        success: false,
        message: "This product is currently unavailable.",
      });
    }

    let availableStock = liveProduct.stock;
    if (item.variantId && liveProduct.variants && liveProduct.variants.length > 0) {
      const v = liveProduct.variants.find(
        (varItem) => varItem._id.toString() === item.variantId.toString()
      );
      if (v) {
        if (v.isAvailable === false) {
          return res.status(400).json({
            success: false,
            message: `The ${v.volumeMl} ml size is currently unavailable.`,
          });
        }
        availableStock = v.stock;
      }
    }

    if (newQty > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} units are currently available in stock.`,
        availableStock,
      });
    }

    item.quantity = newQty;
    await cart.save();

    const formatted = await formatCartResponse(cart);

    return res.status(200).json({
      success: true,
      message: "Bag updated.",
      cart: formatted,
    });
  } catch (error) {
    console.error("Update cart item error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update item quantity.",
    });
  }
};

// ========================================================
// REMOVE CART ITEM (Supports itemId or productId + variantId)
// ========================================================
const removeCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    const variantId = req.query.variantId || req.body?.variantId;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Invalid identifier.",
      });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(200).json({
        success: true,
        cart: await formatCartResponse(null),
      });
    }

    // Check if productId matches a specific cart item _id
    const hasItemIdMatch = cart.items.some(
      (it) => it._id && it._id.toString() === productId.toString()
    );

    if (hasItemIdMatch) {
      cart.items = cart.items.filter(
        (it) => it._id.toString() !== productId.toString()
      );
    } else {
      cart.items = cart.items.filter((item) => {
        const matchesProd = item.product.toString() === productId.toString();
        if (!matchesProd) return true; // keep
        if (variantId) {
          // If variantId specified, remove only matching variant
          return !(item.variantId && item.variantId.toString() === variantId.toString());
        }
        // If no variantId specified and no itemId match, remove first or all matching
        return false;
      });
    }

    await cart.save();

    const formatted = await formatCartResponse(cart);

    return res.status(200).json({
      success: true,
      message: "Item removed from your shopping bag.",
      cart: formatted,
    });
  } catch (error) {
    console.error("Remove cart item error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to remove item from bag.",
    });
  }
};

// ========================================================
// CLEAR CART
// ========================================================
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await Cart.findOne({ user: userId });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    const formatted = await formatCartResponse(cart);

    return res.status(200).json({
      success: true,
      message: "Shopping bag cleared.",
      cart: formatted,
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to clear your shopping bag.",
    });
  }
};

export {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  formatCartResponse,
};

export default {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  formatCartResponse,
};
