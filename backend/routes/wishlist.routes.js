const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
} = require("../controllers/wishlist.controller");

// ========================================
// AUTHENTICATED USER WISHLIST ENDPOINTS
// ========================================

router.use(authMiddleware);

// GET /api/wishlist - Fetch current user's wishlist
router.get("/", getWishlist);

// POST /api/wishlist/items - Add fragrance to wishlist
router.post("/items", addToWishlist);

// DELETE /api/wishlist/items/:productId - Remove fragrance from wishlist
router.delete("/items/:productId", removeFromWishlist);

// POST /api/wishlist/move-to-cart - Move item from wishlist directly to cart
router.post("/move-to-cart", moveToCart);

module.exports = router;
