import express from "express";
import {
  getCategories,
  getCategoryBySlug,
  toggleCategoryStatus,
  getCategoryProducts,
  createCategoryProduct,
} from "../controllers/adminCategory.controller.js";
import adminMiddleware from "../middlewares/admin.middleware.js";
import handleProductUpload from "../middlewares/productUpload.middleware.js";

const router = express.Router();

// Protect all admin category routes with admin authorization
router.use(adminMiddleware);

router.get("/", getCategories);
router.get("/:slug", getCategoryBySlug);
router.patch("/:slug/status", toggleCategoryStatus);
router.get("/:slug/products", getCategoryProducts);
router.post("/:slug/products", handleProductUpload, createCategoryProduct);

export default router;
