const express = require("express");
const router = express.Router();
const {
  getPublicProducts,
  getPublicProductCollections,
  getPublicProductById,
} = require("../controllers/product.controller");

// ========================================
// PUBLIC READ-ONLY PRODUCT ROUTES
// ========================================

// GET /api/products/collections - Category overview / grouped summary
router.get("/collections", getPublicProductCollections);

// GET /api/products - Filtered product catalogue (category, search, pagination)
router.get("/", getPublicProducts);

// GET /api/products/:id - Single product details by ID or slug
router.get("/:id", getPublicProductById);

module.exports = router;
