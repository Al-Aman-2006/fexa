const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const {
  createOrder,
  getMyOrders,
  getOrderById,
} = require("../controllers/order.controller");

router.use(authMiddleware);

// POST /api/orders - Create a new order from current cart
router.post("/", createOrder);

// GET /api/orders - Get user's order history
router.get("/", getMyOrders);

// GET /api/orders/:id - Get specific order details
router.get("/:id", getOrderById);

module.exports = router;
