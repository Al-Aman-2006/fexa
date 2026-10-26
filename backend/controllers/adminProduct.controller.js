import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Product from "../models/product.model.js";
import { validateProduct, normalizeCategory } from "../validators/product.validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to cleanup temporary uploaded files on validation/error failure
const cleanupUploadedFiles = (files) => {
  if (!files || files.length === 0) return;
  files.forEach((file) => {
    try {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (e) {
      console.error("Error cleaning up file:", e.message);
    }
  });
};

// Helper to generate a URL-friendly slug
const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-") // Replace spaces and non-word chars with -
    .replace(/^-+|-+$/g, ""); // Remove leading and trailing -
};

// ========================================
// GET ALL PRODUCTS (Search, Filter, Sort, Paginate)
// ========================================
const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search ? req.query.search.trim() : "";
    const category = req.query.category ? req.query.category.trim() : "All";
    const status = req.query.status ? req.query.status.trim() : "All";

    const queryFilter = {};

    // Category filter
    if (category && category !== "All") {
      const canonical = normalizeCategory(category);
      queryFilter.category = canonical || category;
    }

    // Status filter
    if (status && status !== "All") {
      queryFilter.status = status;
    }

    // Search query across name and brand (and category if All)
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(safeSearch, "i");
      const searchOr = [
        { name: searchRegex },
        { brand: searchRegex },
      ];
      if (!category || category === "All") {
        searchOr.push({ category: searchRegex });
      }
      queryFilter.$or = searchOr;
    }

    const totalProducts = await Product.countDocuments(queryFilter);
    const totalPages = Math.ceil(totalProducts / limit) || 1;

    // Sorting: Latest first (-createdAt)
    const products = await Product.find(queryFilter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Compute live category product counts from MongoDB
    const [menCount, womenCount, unisexCount, allCount] = await Promise.all([
      Product.countDocuments({ category: "Men" }),
      Product.countDocuments({ category: "Women" }),
      Product.countDocuments({ category: "Unisex" }),
      Product.countDocuments({}),
    ]);

    return res.status(200).json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        totalProducts,
        totalPages,
      },
      categoryCounts: {
        men: menCount,
        women: womenCount,
        unisex: unisexCount,
        all: allCount,
      },
    });
  } catch (error) {
    console.error("Get products error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching products.",
    });
  }
};

// ========================================
// GET SINGLE PRODUCT BY ID
// ========================================
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: "Invalid product ID format.",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Get product by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching product details.",
    });
  }
};

// ========================================
// CREATE NEW PRODUCT (With Variant Support)
// ========================================
const createProduct = async (req, res) => {
  try {
    let variants = [];
    if (req.body.variants) {
      try {
        variants = typeof req.body.variants === "string" ? JSON.parse(req.body.variants) : req.body.variants;
      } catch (e) {
        variants = [];
      }
    }

    // Format fields for validation
    const payloadToValidate = {
      name: req.body.name,
      brand: req.body.brand !== undefined ? req.body.brand : "",
      category: req.body.category,
      price: req.body.price,
      compareAtPrice: req.body.compareAtPrice,
      stock: req.body.stock,
      description: req.body.description,
      status: req.body.status || "Active",
      variants,
    };

    const uploadedFiles = req.files || [];

    // Contextual Category Security check (if request specified a category context)
    const expectedContext = req.query.categoryContext || req.headers["x-category-context"];
    if (expectedContext) {
      const normExpected = normalizeCategory(expectedContext);
      const normActual = normalizeCategory(req.body.category);
      if (normExpected && normActual && normExpected !== normActual) {
        cleanupUploadedFiles(uploadedFiles);
        return res.status(400).json({
          success: false,
          message: `Category mismatch: Cannot create a "${req.body.category}" product under "${expectedContext}".`,
          errors: {
            category: `Category mismatch: Product creation must match the selected category (${normExpected}).`,
          },
        });
      }
    }

    const validationResult = validateProduct(payloadToValidate, {
      isEdit: false,
      imageCount: uploadedFiles.length,
    });

    if (!validationResult.isValid) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({
        success: false,
        message: "Validation failed. Please correct the highlighted errors.",
        errors: validationResult.errors,
      });
    }

    const { sanitized } = validationResult;

    // Check duplicate name or slug
    const generatedSlug = generateSlug(sanitized.name);
    const existing = await Product.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${sanitized.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
        { slug: generatedSlug },
      ],
    });

    if (existing) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(409).json({
        success: false,
        message: `A perfume named "${sanitized.name}" already exists in the boutique catalogue.`,
        errors: { name: "Product with this name already exists." },
      });
    }

    // Construct image URLs
    const imageUrls = uploadedFiles.map((file) => `/uploads/products/${file.filename}`);

    // If variants were provided and sanitized, use them
    let finalVariants = [];
    if (sanitized.variants && sanitized.variants.length > 0) {
      finalVariants = sanitized.variants.map((v) => ({
        volumeMl: v.volumeMl,
        sellingPrice: v.sellingPrice,
        originalPrice: v.originalPrice || null,
        stock: v.stock,
        isAvailable: v.isAvailable !== false,
      }));
    } else {
      finalVariants = [
        {
          volumeMl: 100,
          sellingPrice: sanitized.price,
          originalPrice: sanitized.compareAtPrice || null,
          stock: sanitized.stock,
          isAvailable: true,
        },
      ];
    }

    const minSellingPrice = Math.min(...finalVariants.map((v) => Number(v.sellingPrice)));
    const totalStock = finalVariants.reduce((sum, v) => sum + Number(v.stock), 0);

    const product = new Product({
      name: sanitized.name,
      slug: generatedSlug,
      brand: sanitized.brand,
      category: sanitized.category,
      price: minSellingPrice,
      compareAtPrice: sanitized.compareAtPrice || null,
      stock: totalStock,
      description: sanitized.description,
      status: sanitized.status,
      images: imageUrls,
      variants: finalVariants,
    });

    await product.save();

    return res.status(201).json({
      success: true,
      message: `Perfume "${product.name}" created successfully with ${product.variants.length} size options.`,
      product,
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    console.error("Create product error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while creating the product.",
    });
  }
};

// ========================================
// UPDATE PRODUCT (With Variant Support)
// ========================================
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      cleanupUploadedFiles(req.files);
      return res.status(404).json({
        success: false,
        message: "Invalid product identifier.",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      cleanupUploadedFiles(req.files);
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    let variants = [];
    if (req.body.variants) {
      try {
        variants = typeof req.body.variants === "string" ? JSON.parse(req.body.variants) : req.body.variants;
      } catch (e) {
        variants = [];
      }
    } else if (product.variants && product.variants.length > 0) {
      variants = product.variants;
    }

    let existingImages = [];
    if (req.body.existingImages) {
      try {
        existingImages = typeof req.body.existingImages === "string"
          ? JSON.parse(req.body.existingImages)
          : req.body.existingImages;
      } catch (e) {
        existingImages = [];
      }
    } else {
      existingImages = product.images || [];
    }

    const newFiles = req.files || [];
    const totalImages = existingImages.length + newFiles.length;

    const payloadToValidate = {
      name: req.body.name !== undefined ? req.body.name : product.name,
      brand: req.body.brand !== undefined ? req.body.brand : product.brand,
      category: req.body.category !== undefined ? req.body.category : product.category,
      price: req.body.price !== undefined ? req.body.price : product.price,
      compareAtPrice: req.body.compareAtPrice !== undefined ? req.body.compareAtPrice : product.compareAtPrice,
      stock: req.body.stock !== undefined ? req.body.stock : product.stock,
      description: req.body.description !== undefined ? req.body.description : product.description,
      status: req.body.status !== undefined ? req.body.status : product.status,
      variants,
    };

    const validationResult = validateProduct(payloadToValidate, {
      isEdit: true,
      imageCount: totalImages,
    });

    if (!validationResult.isValid) {
      cleanupUploadedFiles(newFiles);
      return res.status(400).json({
        success: false,
        message: "Validation failed. Please correct the highlighted errors.",
        errors: validationResult.errors,
      });
    }

    const { sanitized } = validationResult;

    // Check duplicate name or slug (excluding current product)
    const newSlug = generateSlug(sanitized.name);
    const existing = await Product.findOne({
      _id: { $ne: id },
      $or: [
        { name: { $regex: new RegExp(`^${sanitized.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
        { slug: newSlug },
      ],
    });

    if (existing) {
      cleanupUploadedFiles(newFiles);
      return res.status(409).json({
        success: false,
        message: `Another perfume named "${sanitized.name}" already exists in the catalogue.`,
        errors: { name: "Product with this name already exists." },
      });
    }

    // Build final images list
    const newImageUrls = newFiles.map((file) => `/uploads/products/${file.filename}`);
    const finalImages = [...existingImages, ...newImageUrls];

    // Clean up unlinked removed images from disk
    const removedImages = (product.images || []).filter((img) => !existingImages.includes(img));
    removedImages.forEach((imgUrl) => {
      try {
        const fullDiskPath = path.join(__dirname, "..", imgUrl);
        if (fs.existsSync(fullDiskPath)) {
          fs.unlinkSync(fullDiskPath);
        }
      } catch (err) {
        console.error("Failed to remove old image file:", err.message);
      }
    });

    // Process variants updates
    let finalVariants = [];
    if (sanitized.variants && sanitized.variants.length > 0) {
      finalVariants = sanitized.variants.map((v) => ({
        _id: v._id || undefined,
        volumeMl: v.volumeMl,
        sellingPrice: v.sellingPrice,
        originalPrice: v.originalPrice || null,
        stock: v.stock,
        isAvailable: v.isAvailable !== false,
      }));
    } else {
      finalVariants = product.variants;
    }

    const minSellingPrice = Math.min(...finalVariants.map((v) => Number(v.sellingPrice)));
    const totalStock = finalVariants.reduce((sum, v) => sum + Number(v.stock), 0);

    // Apply updates
    product.name = sanitized.name;
    product.slug = newSlug;
    product.brand = sanitized.brand;
    product.category = sanitized.category;
    product.price = minSellingPrice;
    product.compareAtPrice = sanitized.compareAtPrice || null;
    product.stock = totalStock;
    product.description = sanitized.description;
    product.status = sanitized.status;
    product.images = finalImages;
    product.variants = finalVariants;

    await product.save();

    return res.status(200).json({
      success: true,
      message: `Perfume "${product.name}" updated successfully.`,
      product,
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    console.error("Update product error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the product.",
    });
  }
};

// ========================================
// DELETE PRODUCT
// ========================================
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: "Invalid product identifier.",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    // Delete image files from disk
    if (product.images && product.images.length > 0) {
      product.images.forEach((imgUrl) => {
        try {
          const fullDiskPath = path.join(__dirname, "..", imgUrl);
          if (fs.existsSync(fullDiskPath)) {
            fs.unlinkSync(fullDiskPath);
          }
        } catch (e) {
          console.error("Error deleting image file:", e.message);
        }
      });
    }

    await Product.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Perfume "${product.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error("Delete product error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while deleting the product.",
    });
  }
};

// ========================================
// TOGGLE PRODUCT STATUS (Active / Inactive)
// ========================================
const toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: "Invalid product identifier.",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    // Toggle Active <-> Inactive
    const newStatus = product.status === "Active" ? "Inactive" : "Active";
    product.status = newStatus;
    await product.save();

    return res.status(200).json({
      success: true,
      message: `Product is now ${newStatus}.`,
      product,
    });
  } catch (error) {
    console.error("Toggle status error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while toggling product status.",
    });
  }
};

export {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
};

export default {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
};
