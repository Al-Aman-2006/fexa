import express from "express";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  getCategoryBySlug,
  getCategoryProducts,
  createCategoryProduct,
} from "../controllers/adminCategory.controller.js";
import adminMiddleware from "../middlewares/admin.middleware.js";
import handleProductUpload from "../middlewares/productUpload.middleware.js";

const router = express.Router();

// Protect all admin category routes with admin authorization
router.use(adminMiddleware);

// Category Management CRUD Endpoints
router.get("/", getCategories);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);
router.patch("/:id/status", toggleCategoryStatus);

// Category Product Catalog Integration & Legacy Slug Routes
router.get("/:slug/products", getCategoryProducts);
router.post("/:slug/products", handleProductUpload, createCategoryProduct);
router.patch("/:slug/status", toggleCategoryStatus);
router.get("/:slug", getCategoryBySlug);

export default router;
