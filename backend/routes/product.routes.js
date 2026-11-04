import express from "express";
import {
  getPublicProducts,
  getPublicProductCollections,
  getPublicProductById,
  getPublicCategories,
} from "../controllers/product.controller.js";

const router = express.Router();

// ========================================
// PUBLIC READ-ONLY PRODUCT ROUTES
// ========================================

// GET /api/products/categories - Active categories and child subcategories
router.get("/categories", getPublicCategories);

// GET /api/products/collections - Category overview / grouped summary
router.get("/collections", getPublicProductCollections);

// GET /api/products - Filtered product catalogue (category, search, pagination)
router.get("/", getPublicProducts);

// GET /api/products/:id - Single product details by ID or slug
router.get("/:id", getPublicProductById);

export default router;
