import mongoose from "mongoose";
import fs from "fs";
import Category from "../models/category.model.js";
import Product from "../models/product.model.js";
import { createProduct } from "./adminProduct.controller.js";
import { normalizeCategory } from "../validators/product.validator.js";

// Helper to generate a URL-friendly slug
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// Normalizer for category slug (for legacy routes)
const normalizeCategorySlug = (slug) => {
  if (!slug) return null;
  const lower = slug.toString().trim().toLowerCase();
  if (lower === "men") return { name: "Men", slug: "men" };
  if (lower === "women") return { name: "Women", slug: "women" };
  if (lower === "unisex") return { name: "Unisex", slug: "unisex" };
  return null;
};

// Helper to compute category product counts
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
// 1. GET ALL CATEGORIES (Hierarchical + Summary Stats)
// ========================================
const getCategories = async (req, res) => {
  try {
    // Fetch all categories
    const allCategories = await Category.find({}).sort({ name: 1 });

    // Fetch product counts mapped by parent and child category IDs
    const [allParentCategories, allChildCategories] = [
      allCategories.filter((c) => !c.parentCategory),
      allCategories.filter((c) => Boolean(c.parentCategory)),
    ];

    const totalParents = allParentCategories.length;
    const totalChildren = allChildCategories.length;
    const activeCount = allCategories.filter((c) => c.isActive).length;
    const inactiveCount = allCategories.filter((c) => !c.isActive).length;

    // Build hierarchy: Parent -> Children with product counts
    const parentCategoriesWithChildren = await Promise.all(
      allParentCategories.map(async (parent) => {
        // Find direct child categories
        const children = allChildCategories.filter(
          (ch) => ch.parentCategory.toString() === parent._id.toString()
        );

        // Product count for this parent category
        const parentProductCount = await Product.countDocuments({
          $or: [{ parentCategory: parent._id }, { category: parent.name }],
        });

        // Children with individual product counts
        const childrenWithCounts = await Promise.all(
          children.map(async (child) => {
            const childProductCount = await Product.countDocuments({
              subCategory: child._id,
            });
            return {
              _id: child._id,
              name: child.name,
              slug: child.slug,
              description: child.description,
              image: child.image || "",
              parentCategory: child.parentCategory,
              parentName: parent.name,
              isActive: child.isActive,
              createdAt: child.createdAt,
              updatedAt: child.updatedAt,
              productCount: childProductCount,
            };
          })
        );

        return {
          _id: parent._id,
          name: parent.name,
          slug: parent.slug,
          description: parent.description,
          image: parent.image || "",
          parentCategory: null,
          isActive: parent.isActive,
          createdAt: parent.createdAt,
          updatedAt: parent.updatedAt,
          productCount: parentProductCount,
          children: childrenWithCounts,
        };
      })
    );

    return res.status(200).json({
      success: true,
      stats: {
        totalParents,
        totalChildren,
        activeCount,
        inactiveCount,
      },
      categories: parentCategoriesWithChildren,
      allCategories: allCategories.map((c) => ({
        _id: c._id,
        name: c.name,
        slug: c.slug,
        parentCategory: c.parentCategory,
        isActive: c.isActive,
      })),
    });
  } catch (error) {
    console.error("Get categories error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching categories.",
      error: error.message,
    });
  }
};

// ========================================
// 2. CREATE CATEGORY (Parent or Child Subcategory)
// ========================================
const createCategory = async (req, res) => {
  try {
    const { name, description = "", parentCategory = null, isActive = true, image = "" } = req.body;

    // Validation
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required.",
        errors: { name: "Category name is required." },
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Category name must be at least 2 characters.",
        errors: { name: "Category name must be at least 2 characters." },
      });
    }

    if (trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Category name cannot exceed 100 characters.",
        errors: { name: "Category name cannot exceed 100 characters." },
      });
    }

    // Check for HTML/Script injection
    if (/<[a-z][\s\S]*>/i.test(trimmedName) || /<\/?script/i.test(trimmedName)) {
      return res.status(400).json({
        success: false,
        message: "Category name cannot contain HTML or script tags.",
        errors: { name: "Category name contains invalid characters." },
      });
    }

    let parentDoc = null;
    let baseSlug = slugify(trimmedName);

    // If creating a child subcategory
    if (parentCategory && parentCategory !== "null" && parentCategory !== "") {
      if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent category identifier.",
          errors: { parentCategory: "Invalid parent category ID." },
        });
      }

      parentDoc = await Category.findById(parentCategory);
      if (!parentDoc) {
        return res.status(404).json({
          success: false,
          message: "Parent category not found.",
          errors: { parentCategory: "Selected parent category does not exist." },
        });
      }

      // Enforce max 2-level hierarchy: Parent category cannot itself be a subcategory
      if (parentDoc.parentCategory) {
        return res.status(400).json({
          success: false,
          message: "Subcategories cannot have child categories. Maximum hierarchy depth is 2.",
          errors: { parentCategory: "Cannot assign a subcategory as parent." },
        });
      }

      // Check duplicate subcategory name under the same parent
      const duplicateChild = await Category.findOne({
        parentCategory: parentDoc._id,
        name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      });

      if (duplicateChild) {
        return res.status(409).json({
          success: false,
          message: `A subcategory named "${trimmedName}" already exists under ${parentDoc.name}.`,
          errors: { name: `Subcategory "${trimmedName}" already exists under ${parentDoc.name}.` },
        });
      }

      baseSlug = `${parentDoc.slug}-${baseSlug}`;
    } else {
      // Creating a parent category: check duplicate parent category name
      const duplicateParent = await Category.findOne({
        parentCategory: null,
        name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      });

      if (duplicateParent) {
        return res.status(409).json({
          success: false,
          message: `A parent category named "${trimmedName}" already exists.`,
          errors: { name: `Parent category "${trimmedName}" already exists.` },
        });
      }
    }

    // Ensure slug uniqueness
    let finalSlug = baseSlug;
    let slugCollision = await Category.findOne({ slug: finalSlug });
    let counter = 1;
    while (slugCollision) {
      finalSlug = `${baseSlug}-${counter++}`;
      slugCollision = await Category.findOne({ slug: finalSlug });
    }

    const newCategory = await Category.create({
      name: trimmedName,
      slug: finalSlug,
      description: description ? description.trim() : "",
      image: image ? image.trim() : "",
      parentCategory: parentDoc ? parentDoc._id : null,
      isActive: Boolean(isActive),
    });

    return res.status(201).json({
      success: true,
      message: parentDoc
        ? `Subcategory "${newCategory.name}" successfully created under ${parentDoc.name}.`
        : `Parent category "${newCategory.name}" successfully created.`,
      category: newCategory,
    });
  } catch (error) {
    console.error("Create category error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create category.",
    });
  }
};

// ========================================
// 3. UPDATE CATEGORY (Edit Parent or Child)
// ========================================
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description = "", parentCategory = null, isActive, image = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID.",
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    // Validate name
    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName || trimmedName.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Category name must be at least 2 characters.",
          errors: { name: "Category name must be at least 2 characters." },
        });
      }

      // Check duplicates
      const targetParentId = parentCategory !== undefined ? (parentCategory ? parentCategory : null) : category.parentCategory;

      if (targetParentId) {
        // Child category duplicate check
        const dup = await Category.findOne({
          _id: { $ne: category._id },
          parentCategory: targetParentId,
          name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        });
        if (dup) {
          return res.status(409).json({
            success: false,
            message: `A subcategory named "${trimmedName}" already exists under this parent category.`,
            errors: { name: `Subcategory "${trimmedName}" already exists under this parent.` },
          });
        }
      } else {
        // Parent category duplicate check
        const dup = await Category.findOne({
          _id: { $ne: category._id },
          parentCategory: null,
          name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        });
        if (dup) {
          return res.status(409).json({
            success: false,
            message: `A parent category named "${trimmedName}" already exists.`,
            errors: { name: `Parent category "${trimmedName}" already exists.` },
          });
        }
      }

      category.name = trimmedName;
    }

    // Update parentCategory if specified
    if (parentCategory !== undefined) {
      if (parentCategory && parentCategory !== "null") {
        if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
          return res.status(400).json({
            success: false,
            message: "Invalid parent category identifier.",
          });
        }

        // Cannot set self as parent
        if (parentCategory.toString() === category._id.toString()) {
          return res.status(400).json({
            success: false,
            message: "A category cannot be its own parent.",
            errors: { parentCategory: "A category cannot be its own parent." },
          });
        }

        const newParent = await Category.findById(parentCategory);
        if (!newParent) {
          return res.status(404).json({
            success: false,
            message: "Target parent category does not exist.",
          });
        }

        // Prevent circular reference (if this category already has child categories, it cannot become a child)
        const hasChildren = await Category.countDocuments({ parentCategory: category._id });
        if (hasChildren > 0) {
          return res.status(400).json({
            success: false,
            message: "Cannot convert a parent category with existing subcategories into a child category.",
            errors: { parentCategory: "Category currently has active subcategories." },
          });
        }

        category.parentCategory = newParent._id;
      } else {
        category.parentCategory = null;
      }
    }

    if (description !== undefined) category.description = description.trim();
    if (image !== undefined) category.image = image.trim();
    if (typeof isActive === "boolean") category.isActive = isActive;

    await category.save();

    return res.status(200).json({
      success: true,
      message: `Category "${category.name}" updated successfully.`,
      category,
    });
  } catch (error) {
    console.error("Update category error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update category.",
    });
  }
};

// ========================================
// 4. TOGGLE / UPDATE CATEGORY STATUS
// ========================================
const toggleCategoryStatus = async (req, res) => {
  try {
    const { id, slug } = req.params;
    let category = null;

    if (id && mongoose.Types.ObjectId.isValid(id)) {
      category = await Category.findById(id);
    } else if (slug || id) {
      const searchSlug = (slug || id).toString().trim().toLowerCase();
      category = await Category.findOne({ slug: searchSlug });
    }

    if (!category) {
      // Legacy fallback for slug: auto-initialize if Men, Women, or Unisex
      const normalized = normalizeCategorySlug(slug || id);
      if (normalized) {
        category = await Category.create({
          name: normalized.name,
          slug: normalized.slug,
          isActive: true,
        });
      } else {
        return res.status(404).json({
          success: false,
          message: "Category not found.",
        });
      }
    }

    // Determine target status
    if (req.body && typeof req.body.isActive === "boolean") {
      category.isActive = req.body.isActive;
    } else {
      category.isActive = !category.isActive;
    }

    await category.save();

    return res.status(200).json({
      success: true,
      message: `Category "${category.name}" is now ${category.isActive ? "Active" : "Inactive"}.`,
      category,
    });
  } catch (error) {
    console.error("Toggle category status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update category status.",
    });
  }
};

// ========================================
// 5. DELETE CATEGORY (Safe Deletion with Guardrails)
// ========================================
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format.",
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    // Guardrail 1: Check if this category has child categories
    const childCount = await Category.countDocuments({ parentCategory: category._id });
    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete parent category "${category.name}" because it contains ${childCount} subcategory(s). Please delete or reassign all subcategories first.`,
      });
    }

    // Guardrail 2: Check if this category has attached products
    const productCount = await Product.countDocuments({
      $or: [
        { parentCategory: category._id },
        { subCategory: category._id },
        { category: category.name },
      ],
    });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category "${category.name}". ${productCount} active fragrance product(s) are assigned to it. Please reassign or delete these products first to prevent orphaned records.`,
      });
    }

    await Category.deleteOne({ _id: category._id });

    return res.status(200).json({
      success: true,
      message: `Category "${category.name}" was safely deleted.`,
    });
  } catch (error) {
    console.error("Delete category error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete category.",
    });
  }
};

// ========================================
// 6. LEGACY / SLUG ENDPOINTS (BACKWARD COMPATIBILITY)
// ========================================
const getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const lowerSlug = slug.toString().trim().toLowerCase();

    let category = await Category.findOne({ slug: lowerSlug });
    if (!category) {
      const normalized = normalizeCategorySlug(slug);
      if (normalized) {
        category = await Category.create({
          name: normalized.name,
          slug: normalized.slug,
          isActive: true,
        });
      } else {
        return res.status(404).json({
          success: false,
          message: "Category not found.",
        });
      }
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

const getCategoryProducts = async (req, res) => {
  try {
    const { slug } = req.params;
    const lowerSlug = slug.toString().trim().toLowerCase();

    let category = await Category.findOne({ slug: lowerSlug });
    const categoryName = category ? category.name : (normalizeCategorySlug(slug)?.name || slug);

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search ? req.query.search.trim() : "";
    const status = req.query.status ? req.query.status.trim() : "All";

    const queryFilter = {
      $or: [
        { category: categoryName },
        ...(category ? [{ parentCategory: category._id }, { subCategory: category._id }] : []),
      ],
    };

    if (status && status !== "All") {
      queryFilter.status = status;
    }

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(safeSearch, "i");
      queryFilter.$and = [{ $or: [{ name: searchRegex }, { brand: searchRegex }] }];
    }

    const totalProducts = await Product.countDocuments(queryFilter);
    const totalPages = Math.ceil(totalProducts / limit) || 1;

    const products = await Product.find(queryFilter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const counts = await getCategoryCountsForName(categoryName);

    return res.status(200).json({
      success: true,
      category: {
        name: categoryName,
        slug: lowerSlug,
        isActive: category ? category.isActive : true,
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

const createCategoryProduct = async (req, res) => {
  try {
    const { slug } = req.params;
    const lowerSlug = slug.toString().trim().toLowerCase();
    const category = await Category.findOne({ slug: lowerSlug });
    const categoryName = category ? category.name : (normalizeCategorySlug(slug)?.name || slug);

    if (req.body.category && req.body.category !== categoryName) {
      return res.status(400).json({
        success: false,
        message: `Category mismatch: Cannot create a "${req.body.category}" product from the ${categoryName} route.`,
      });
    }

    req.body.category = categoryName;
    if (category) {
      req.body.parentCategory = category._id;
    }

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
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  getCategoryBySlug,
  getCategoryProducts,
  createCategoryProduct,
  getCategoryCountsForName,
  normalizeCategorySlug,
};

export default {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  getCategoryBySlug,
  getCategoryProducts,
  createCategoryProduct,
  getCategoryCountsForName,
  normalizeCategorySlug,
};
