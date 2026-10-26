import mongoose from "mongoose";
import fs from "fs";
import Category from "../models/category.model.js";
import Product from "../models/product.model.js";
import { createProduct } from "./adminProduct.controller.js";
import { normalizeCategory } from "../validators/product.validator.js";

// Normalizer for category slug
const normalizeCategorySlug = (slug) => {
  if (!slug) return null;
  const lower = slug.toString().trim().toLowerCase();
  if (lower === "men") return { name: "Men", slug: "men" };
  if (lower === "women") return { name: "Women", slug: "women" };
  if (lower === "unisex") return { name: "Unisex", slug: "unisex" };
  return null;
};

// Helper to compute category counts from MongoDB Product collection
const getCategoryCountsForName = async (categoryName) => {
  const [totalProducts, activeProducts, inactiveProducts, outOfStockProducts] =
    await Promise.all([
      Product.countDocuments({ category: categoryName }),
      Product.countDocuments({ category: categoryName, status: "Active" }),
      Product.countDocuments({ category: categoryName, status: "Inactive" }),
      Product.countDocuments({
        category: categoryName,
        $or: [{ status: "Out of Stock" }, { stock: 0 }],
      }),
    ]);

  return {
    totalProducts,
    activeProducts,
    inactiveProducts,
    outOfStockProducts,
  };
};

// ========================================
// GET ALL CATEGORIES WITH REAL PRODUCT COUNTS
// ========================================
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });

    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const counts = await getCategoryCountsForName(cat.name);
        return {
          _id: cat._id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          isActive: cat.isActive,
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt,
          counts,
        };
      })
    );

    return res.status(200).json({
      success: true,
      categories: categoriesWithCounts,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching categories.",
    });
  }
};

// ========================================
// GET SINGLE CATEGORY BY SLUG (WITH COUNTS)
// ========================================
const getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const normalized = normalizeCategorySlug(slug);

    if (!normalized) {
      return res.status(404).json({
        success: false,
        message: "Invalid category. Must be Men, Women, or Unisex.",
      });
    }

    let category = await Category.findOne({ slug: normalized.slug });
    if (!category) {
      // Auto-initialize if missing
      category = await Category.create({
        name: normalized.name,
        slug: normalized.slug,
        isActive: true,
      });
    }

    const counts = await getCategoryCountsForName(category.name);

    return res.status(200).json({
      success: true,
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: category.isActive,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        counts,
      },
    });
  } catch (error) {
    console.error("Get category by slug error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving category information.",
    });
  }
};

// ========================================
// TOGGLE / UPDATE CATEGORY ACTIVATION STATUS
// ========================================
const toggleCategoryStatus = async (req, res) => {
  try {
    const { slug } = req.params;
    const normalized = normalizeCategorySlug(slug);

    if (!normalized) {
      return res.status(404).json({
        success: false,
        message: "Invalid category identifier. Must be Men, Women, or Unisex.",
      });
    }

    let category = await Category.findOne({ slug: normalized.slug });
    if (!category) {
      category = await Category.create({
        name: normalized.name,
        slug: normalized.slug,
        isActive: true,
      });
    }

    // Determine target status
    if (req.body && typeof req.body.isActive === "boolean") {
      category.isActive = req.body.isActive;
    } else {
      category.isActive = !category.isActive;
    }

    await category.save();

    const counts = await getCategoryCountsForName(category.name);

    return res.status(200).json({
      success: true,
      message: `${category.name} category is now ${
        category.isActive ? "Active" : "Inactive"
      }.`,
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: category.isActive,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        counts,
      },
    });
  } catch (error) {
    console.error("Toggle category status error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while updating category activation status.",
    });
  }
};

// ========================================
// GET CATEGORY-SPECIFIC PRODUCTS (Paginated, Searchable, Filterable)
// ========================================
const getCategoryProducts = async (req, res) => {
  try {
    const { slug } = req.params;
    const normalized = normalizeCategorySlug(slug);

    if (!normalized) {
      return res.status(404).json({
        success: false,
        message: "Invalid category. Must be Men, Women, or Unisex.",
      });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search ? req.query.search.trim() : "";
    const status = req.query.status ? req.query.status.trim() : "All";

    const queryFilter = {
      category: normalized.name,
    };

    if (status && status !== "All") {
      queryFilter.status = status;
    }

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(safeSearch, "i");
      queryFilter.$or = [{ name: searchRegex }, { brand: searchRegex }];
    }

    const totalProducts = await Product.countDocuments(queryFilter);
    const totalPages = Math.ceil(totalProducts / limit) || 1;

    const products = await Product.find(queryFilter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const counts = await getCategoryCountsForName(normalized.name);
    const categoryDoc = await Category.findOne({ slug: normalized.slug });

    return res.status(200).json({
      success: true,
      category: {
        name: normalized.name,
        slug: normalized.slug,
        isActive: categoryDoc ? categoryDoc.isActive : true,
        counts,
      },
      products,
      pagination: {
        page,
        limit,
        totalProducts,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get category products error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching products for this category.",
    });
  }
};

// ========================================
// CREATE CATEGORY PRODUCT (STRICT CATEGORY SECURITY ENFORCEMENT)
// ========================================
const createCategoryProduct = async (req, res) => {
  try {
    const { slug } = req.params;
    const normalized = normalizeCategorySlug(slug);

    if (!normalized) {
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          try {
            if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
          } catch (e) {}
        });
      }
      return res.status(404).json({
        success: false,
        message: "Invalid category route. Must be Men, Women, or Unisex.",
      });
    }

    // CATEGORY SECURITY ENFORCEMENT:
    // If client supplied a category value, it MUST match this route's category.
    // Reject attempts to create Men product on Women/Unisex route, etc.
    if (req.body.category) {
      const bodyCategoryNorm = normalizeCategory(req.body.category);
      if (bodyCategoryNorm !== normalized.name) {
        if (req.files && req.files.length > 0) {
          req.files.forEach((file) => {
            try {
              if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
            } catch (e) {}
          });
        }
        return res.status(400).json({
          success: false,
          message: `Category mismatch: Cannot create a "${req.body.category}" product from the ${normalized.name} Category route.`,
          errors: {
            category: `Category mismatch: Only ${normalized.name} products can be created on this route.`,
          },
        });
      }
    }

    // Force category to the authorized route category
    req.body.category = normalized.name;

    return createProduct(req, res);
  } catch (error) {
    console.error("Create category product error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create category product.",
    });
  }
};

export {
  getCategories,
  getCategoryBySlug,
  toggleCategoryStatus,
  getCategoryProducts,
  createCategoryProduct,
  getCategoryCountsForName,
  normalizeCategorySlug,
};

export default {
  getCategories,
  getCategoryBySlug,
  toggleCategoryStatus,
  getCategoryProducts,
  createCategoryProduct,
  getCategoryCountsForName,
  normalizeCategorySlug,
};
