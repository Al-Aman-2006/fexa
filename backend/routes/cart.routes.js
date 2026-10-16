const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
} = require("../controllers/cart.controller");

// ========================================
// AUTHENTICATED USER CART ENDPOINTS
// ========================================

router.use(authMiddleware);

// GET /api/cart - Fetch current user's cart
router.get("/", getCart);

// POST /api/cart and /api/cart/items - Add product to cart
router.post("/items", addToCart);
router.post("/", addToCart);

// PATCH /api/cart/items/:productId and /api/cart/:productId - Update item quantity
router.patch("/items/:productId", updateCartItemQuantity);
router.patch("/:productId", updateCartItemQuantity);

// DELETE /api/cart/items/:productId and /api/cart/:productId - Remove item from cart
router.delete("/items/:productId", removeCartItem);
router.delete("/:productId", removeCartItem);

// DELETE /api/cart - Clear entire cart
router.delete("/", clearCart);
router.delete("/clear/all", clearCart);

module.exports = router;
