const mongoose = require("mongoose");
const User = require("../models/user.model");
const Product = require("../models/product.model");
const Cart = require("../models/cart.model");
const { formatCartResponse } = require("./cart.controller");

// Helper to format wishlist products and prune deleted product references
const formatWishlistProducts = async (userDoc) => {
  if (!userDoc) return { wishlist: [], count: 0 };

  await userDoc.populate({
    path: "wishlist",
    select: "_id name slug brand category price compareAtPrice stock images status variants",
  });

  const formattedItems = [];
  const validIdsToKeep = [];
  let hasPruned = false;

  for (const item of userDoc.wishlist) {
    // 1. If product was deleted from MongoDB by Admin, safely prune the stale reference
    if (!item) {
      hasPruned = true;
      continue;
    }

    const isInactive = item.status === "Inactive";
    let isOutOfStock = false;
    let livePrice = Number(item.price) || 0;
    let liveStock = Number(item.stock) || 0;
    const compareAtPrice = Number(item.compareAtPrice) || 0;

    if (item.variants && item.variants.length > 0) {
      const activeVariants = item.variants.filter((v) => v.isAvailable !== false);
      const hasPurchasableStock = activeVariants.some((v) => Number(v.stock) > 0);
      isOutOfStock = !hasPurchasableStock || item.status === "Out of Stock";
      if (activeVariants.length > 0) {
        livePrice = Math.min(...activeVariants.map((v) => Number(v.sellingPrice)));
      }
      liveStock = item.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    } else {
      isOutOfStock = liveStock === 0 || item.status === "Out of Stock";
    }

    formattedItems.push({
      _id: item._id,
      productId: item._id,
      name: item.name,
      slug: item.slug,
      brand: item.brand || "FEXA",
      category: item.category,
      price: livePrice,
      compareAtPrice,
      images: item.images || [],
      primaryImage: item.images && item.images.length > 0 ? item.images[0] : null,
      stock: liveStock,
      status: item.status,
      variants: item.variants || [],
      isInactive,
      isOutOfStock,
    });

    validIdsToKeep.push(item._id);
  }

  // If deleted products were detected, update user's wishlist in DB
  if (hasPruned) {
    userDoc.wishlist = validIdsToKeep;
    await userDoc.save();
  }

  return {
    wishlist: formattedItems,
    count: formattedItems.length,
  };
};

// ========================================================
// GET CURRENT USER WISHLIST
// ========================================================
const getWishlist = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const { wishlist, count } = await formatWishlistProducts(user);

    return res.status(200).json({
      success: true,
      wishlist,
      count,
    });
  } catch (error) {
    console.error("Get wishlist error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load your wishlist. Please try again.",
    });
  }
};

// ========================================================
// ADD ITEM TO WISHLIST
// ========================================================
const addToWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    // 1. Validate Product ID
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product identifier.",
      });
    }

    // 2. Fetch live product from MongoDB
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Fragrance not found.",
      });
    }

    // 3. Product availability check
    if (product.status === "Inactive") {
      return res.status(400).json({
        success: false,
        message: "This fragrance is currently inactive and unavailable.",
      });
    }

    // 4. Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    // Ensure wishlist array exists
    if (!Array.isArray(user.wishlist)) {
      user.wishlist = [];
    }

    // 5. Prevent duplicate entries
    const alreadyExists = user.wishlist.some(
      (id) => id && id.toString() === productId.toString()
    );

    if (alreadyExists) {
      const { wishlist, count } = await formatWishlistProducts(user);
      return res.status(200).json({
        success: true,
        alreadyExists: true,
        message: `${product.name} is already in your wishlist.`,
        wishlist,
        count,
      });
    }

    // 6. Append product ObjectId and save
    user.wishlist.push(product._id);
    await user.save();

    const { wishlist, count } = await formatWishlistProducts(user);

    return res.status(201).json({
      success: true,
      message: `${product.name} saved to your wishlist.`,
      wishlist,
      count,
    });
  } catch (error) {
    console.error("Add to wishlist error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to save fragrance to your wishlist. Please try again.",
    });
  }
};

// ========================================================
// REMOVE ITEM FROM WISHLIST
// ========================================================
const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product identifier.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    if (!Array.isArray(user.wishlist)) {
      user.wishlist = [];
    }

    const initialLength = user.wishlist.length;
    user.wishlist = user.wishlist.filter(
      (id) => id && id.toString() !== productId.toString()
    );

    if (user.wishlist.length !== initialLength) {
      await user.save();
    }

    const { wishlist, count } = await formatWishlistProducts(user);

    return res.status(200).json({
      success: true,
      message: "Fragrance removed from your wishlist.",
      wishlist,
      count,
    });
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to remove fragrance from wishlist. Please try again.",
    });
  }
};

// ========================================================
// MOVE ITEM FROM WISHLIST TO CART (ATOMIC CART ADD + WISHLIST REMOVE)
// ========================================================
const moveToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, variantId, quantity = 1 } = req.body;

    // 1. Validate Product ID
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
        message: "Maximum 5 items allowed per product size.",
      });
    }

    // 2. Fetch live product from MongoDB
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    // 3. Check if product is active
    if (product.status === "Inactive") {
      return res.status(400).json({
        success: false,
        message: "This fragrance is currently unavailable.",
      });
    }

    // 4. Resolve variant if product has variants
    let selectedVariant = null;
    if (product.variants && product.variants.length > 0) {
      if (variantId) {
        selectedVariant = product.variants.find(
          (v) => v._id && v._id.toString() === variantId.toString()
        );
        if (!selectedVariant) {
          return res.status(400).json({
            success: false,
            message: "The requested perfume size variant is invalid.",
          });
        }
      } else {
        // Default to first purchasable in-stock variant, or first available variant
        const firstInStock = product.variants.find(
          (v) => v.isAvailable !== false && v.stock > 0
        );
        const firstAvailable = product.variants.find(
          (v) => v.isAvailable !== false
        );
        selectedVariant = firstInStock || firstAvailable || product.variants[0];
      }
    }

    const variantStock = selectedVariant ? Number(selectedVariant.stock) : Number(product.stock || 0);
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

    // 5. Find or initialize user cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // 6. Check existing cart quantity matching BOTH product and variant
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
          message: `Only ${variantStock} units are currently available in ${volumeMl} ml. You already have ${currentQty} in your bag.`,
          availableStock: variantStock,
        });
      }

      cart.items[existingIndex].quantity = newTotalQty;
    } else {
      if (requestedQty > variantStock) {
        return res.status(400).json({
          success: false,
          message: `Only ${variantStock} units are currently available in stock.`,
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

    // Save cart
    await cart.save();

    // 7. ONLY AFTER cart addition succeeds: remove from wishlist in MongoDB
    const user = await User.findById(userId);
    if (user && Array.isArray(user.wishlist)) {
      user.wishlist = user.wishlist.filter(
        (id) => id && id.toString() !== productId.toString()
      );
      await user.save();
    }

    const formattedCart = await formatCartResponse(cart);
    const { wishlist: formattedWishlist, count: wishlistCount } = await formatWishlistProducts(user);

    return res.status(200).json({
      success: true,
      message: `${product.name} (${volumeMl} ml) added to your shopping bag and removed from wishlist.`,
      cart: formattedCart,
      wishlist: formattedWishlist,
      wishlistCount,
      count: wishlistCount,
    });
  } catch (error) {
    console.error("Move to cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to move product to your shopping bag. Please try again.",
    });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
};
