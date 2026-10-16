const express = require("express");
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
} = require("../controllers/adminProduct.controller");

const adminMiddleware = require("../middlewares/admin.middleware");
const handleProductUpload = require("../middlewares/productUpload.middleware");

// Require admin authentication for all product management routes
router.use(adminMiddleware);

router.get("/", getProducts);
router.get("/:id", getProductById);
router.post("/", handleProductUpload, createProduct);
router.put("/:id", handleProductUpload, updateProduct);
router.delete("/:id", deleteProduct);
router.patch("/:id/status", toggleProductStatus);

module.exports = router;
