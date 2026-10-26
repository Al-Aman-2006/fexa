import express from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
} from "../controllers/adminProduct.controller.js";
import adminMiddleware from "../middlewares/admin.middleware.js";
import handleProductUpload from "../middlewares/productUpload.middleware.js";

const router = express.Router();

// Require admin authentication for all product management routes
router.use(adminMiddleware);

router.get("/", getProducts);
router.get("/:id", getProductById);
router.post("/", handleProductUpload, createProduct);
router.put("/:id", handleProductUpload, updateProduct);
router.delete("/:id", deleteProduct);
router.patch("/:id/status", toggleProductStatus);

export default router;
