import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
} from "../controllers/wishlist.controller.js";

const router = express.Router();

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

export default router;
