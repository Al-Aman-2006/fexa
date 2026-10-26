import mongoose from "mongoose";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import Review from "../models/review.model.js";

// Normalizer for category matching (Men, Women, Unisex)
const normalizeCategory = (cat) => {
  if (!cat) return null;
  const lower = cat.toString().trim().toLowerCase();
  if (lower === "men") return "Men";
  if (lower === "women") return "Women";
  if (lower === "unisex") return "Unisex";
  return null;
};

// Helper to fetch active category map
const getCategoryStatusMap = async () => {
  const allCategories = await Category.find({});
  const statusMap = { Men: true, Women: true, Unisex: true };
  allCategories.forEach((c) => {
    statusMap[c.name] = c.isActive;
  });
  return statusMap;
};

// ========================================================
// GET PUBLIC PRODUCTS (Filtered by category, search, sort, pagination)
// STRICT: Only returns Active or Out of Stock products from ACTIVE categories
// ========================================================
const getPublicProducts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const rawCategory = req.query.category ? req.query.category.trim() : null;
    const search = req.query.search ? req.query.search.trim() : "";
    const sortParam = (req.query.sort || "featured").toLowerCase().trim();
    const excludeId = req.query.excludeId ? req.query.excludeId.trim() : null;

    // Retrieve live category activation statuses
    const categoryStatusMap = await getCategoryStatusMap();
    const activeCategories = Object.keys(categoryStatusMap).filter(
      (name) => categoryStatusMap[name] === true
    );

    // Build query filter
    // Only show active products (or Out of Stock with stock:0). Never show Inactive.
    const queryFilter = {
      status: { $in: ["Active", "Out of Stock"] },
    };

    // Exclude specific product ID if requested (useful for related products)
    if (excludeId && excludeId.match(/^[0-9a-fA-F]{24}$/)) {
      queryFilter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    // Category filter: Men, Women, Unisex, or All
    if (rawCategory && rawCategory.toLowerCase() !== "all") {
      const canonicalCategory = normalizeCategory(rawCategory);

      // If category is currently inactive, return 0 products immediately
      if (canonicalCategory && categoryStatusMap[canonicalCategory] === false) {
        const [rawMenCount, rawWomenCount, rawUnisexCount] = await Promise.all([
          Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Men" }),
          Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Women" }),
          Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Unisex" }),
        ]);

        const safeMen = categoryStatusMap.Men ? rawMenCount : 0;
        const safeWomen = categoryStatusMap.Women ? rawWomenCount : 0;
        const safeUnisex = categoryStatusMap.Unisex ? rawUnisexCount : 0;

        return res.status(200).json({
          success: true,
          products: [],
          pagination: {
            page,
            limit,
            totalProducts: 0,
            totalPages: 1,
          },
          categoryCounts: {
            all: safeMen + safeWomen + safeUnisex,
            men: safeMen,
            women: safeWomen,
            unisex: safeUnisex,
          },
          isCategoryInactive: true,
          category: canonicalCategory,
          categoryStatuses: categoryStatusMap,
          message: `The ${canonicalCategory} collection is currently unavailable.`,
        });
      }

      if (canonicalCategory && categoryStatusMap[canonicalCategory] !== false) {
        queryFilter.category = canonicalCategory;
      } else {
        queryFilter.category = "__INVALID__";
      }
    } else {
      // General or search catalogue: strictly exclude products from inactive categories
      queryFilter.category = { $in: activeCategories };
    }

    // Search filter across name, brand, category, description (with regex escaping for safety)
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(safeSearch, "i");
      queryFilter.$or = [
        { name: searchRegex },
        { brand: searchRegex },
        { category: searchRegex },
        { description: searchRegex },
      ];
    }

    // Determine sorting criteria
    let sortStage = { createdAt: -1, _id: 1 };
    if (sortParam === "price-low") {
      sortStage = { effectivePrice: 1, _id: 1 };
    } else if (sortParam === "price-high") {
      sortStage = { effectivePrice: -1, _id: 1 };
    } else if (sortParam === "name-asc" || sortParam === "name") {
      sortStage = { name: 1, _id: 1 };
    } else if (sortParam === "name-desc") {
      sortStage = { name: -1, _id: 1 };
    } else if (sortParam === "latest") {
      sortStage = { createdAt: -1, _id: 1 };
    } else if (sortParam === "featured" || sortParam === "default") {
      sortStage = { createdAt: -1, _id: 1 };
    }

    // Aggregation pipeline to compute representative variant price across the whole dataset before pagination
    const pipeline = [
      { $match: queryFilter },
      {
        $addFields: {
          effectivePrice: {
            $let: {
              vars: {
                availableVariants: {
                  $filter: {
                    input: { $ifNull: ["$variants", []] },
                    as: "v",
                    cond: {
                      $and: [
                        { $ne: ["$$v.isAvailable", false] },
                        { $gt: [{ $ifNull: ["$$v.stock", 0] }, 0] },
                      ],
                    },
                  },
                },
                anyActiveVariants: {
                  $filter: {
                    input: { $ifNull: ["$variants", []] },
                    as: "v",
                    cond: { $ne: ["$$v.isAvailable", false] },
                  },
                },
              },
              in: {
                $cond: [
                  { $gt: [{ $size: "$$availableVariants" }, 0] },
                  { $min: "$$availableVariants.sellingPrice" },
                  {
                    $cond: [
                      { $gt: [{ $size: "$$anyActiveVariants" }, 0] },
                      { $min: "$$anyActiveVariants.sellingPrice" },
                      { $ifNull: ["$price", 0] },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      { $sort: sortStage },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                name: 1,
                slug: 1,
                description: 1,
                brand: 1,
                category: 1,
                price: 1,
                compareAtPrice: 1,
                stock: 1,
                images: 1,
                status: 1,
                createdAt: 1,
                variants: 1,
                effectivePrice: 1,
              },
            },
          ],
        },
      },
    ];

    const aggregateQuery = Product.aggregate(pipeline);
    if (sortParam === "name-asc" || sortParam === "name" || sortParam === "name-desc") {
      aggregateQuery.collation({ locale: "en", strength: 2 });
    }

    // Execute aggregation and category counts concurrently
    const [aggregateResult, menCount, womenCount, unisexCount] = await Promise.all([
      aggregateQuery,
      Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Men" }),
      Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Women" }),
      Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Unisex" }),
    ]);

    const safeMen = categoryStatusMap.Men ? menCount : 0;
    const safeWomen = categoryStatusMap.Women ? womenCount : 0;
    const safeUnisex = categoryStatusMap.Unisex ? unisexCount : 0;
    const safeAll = safeMen + safeWomen + safeUnisex;

    const facet = aggregateResult[0] || { metadata: [], data: [] };
    const totalProducts = facet.metadata && facet.metadata.length > 0 ? facet.metadata[0].total : 0;
    const totalPages = Math.ceil(totalProducts / limit) || 1;
    const products = facet.data || [];

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
        all: safeAll,
        men: safeMen,
        women: safeWomen,
        unisex: safeUnisex,
      },
      categoryStatuses: categoryStatusMap,
    });
  } catch (error) {
    console.error("Get public products error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load collection fragrances. Please try again.",
    });
  }
};

// ========================================================
// GET PUBLIC COLLECTIONS SUMMARY (All 3 categories in one efficient call)
// Respects category activation: Inactive categories return empty/inactive
// ========================================================
const getPublicProductCollections = async (req, res) => {
  try {
    const safeProjection = "_id name slug description brand category price compareAtPrice stock images status createdAt variants";
    const categoryStatusMap = await getCategoryStatusMap();

    // Query active products for each category only if that category is active
    const [menProducts, womenProducts, unisexProducts, menCount, womenCount, unisexCount] =
      await Promise.all([
        categoryStatusMap.Men
          ? Product.find({ status: { $in: ["Active", "Out of Stock"] }, category: "Men" })
              .select(safeProjection)
              .sort({ createdAt: -1 })
              .limit(8)
          : Promise.resolve([]),
        categoryStatusMap.Women
          ? Product.find({ status: { $in: ["Active", "Out of Stock"] }, category: "Women" })
              .select(safeProjection)
              .sort({ createdAt: -1 })
              .limit(8)
          : Promise.resolve([]),
        categoryStatusMap.Unisex
          ? Product.find({ status: { $in: ["Active", "Out of Stock"] }, category: "Unisex" })
              .select(safeProjection)
              .sort({ createdAt: -1 })
              .limit(8)
          : Promise.resolve([]),
        categoryStatusMap.Men
          ? Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Men" })
          : Promise.resolve(0),
        categoryStatusMap.Women
          ? Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Women" })
          : Promise.resolve(0),
        categoryStatusMap.Unisex
          ? Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Unisex" })
          : Promise.resolve(0),
      ]);

    const totalCount = menCount + womenCount + unisexCount;

    return res.status(200).json({
      success: true,
      collections: {
        men: {
          title: "Men's Collection",
          subtitle: "Defined by Presence. Rich smoked woods, amber resins, and Italian leather.",
          count: menCount,
          products: menProducts,
          isActive: categoryStatusMap.Men !== false,
        },
        women: {
          title: "Women's Collection",
          subtitle: "Crafted for Elegance. Radiant florals, Grasse rose, and powdery white amber.",
          count: womenCount,
          products: womenProducts,
          isActive: categoryStatusMap.Women !== false,
        },
        unisex: {
          title: "Unisex Collection",
          subtitle: "Fragrance Without Boundaries. Crisp bergamot, mineral sea salt, and velvet cashmeran.",
          count: unisexCount,
          products: unisexProducts,
          isActive: categoryStatusMap.Unisex !== false,
        },
      },
      counts: {
        all: totalCount,
        men: menCount,
        women: womenCount,
        unisex: unisexCount,
      },
      categoryStatuses: categoryStatusMap,
    });
  } catch (error) {
    console.error("Get public collections error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load collections overview. Please try again.",
    });
  }
};

// ========================================================
// GET SINGLE PUBLIC PRODUCT (By ID or slug)
// Respects category activation: Inactive category products return 400 unavailable
// ========================================================
const getPublicProductById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if id is a valid Mongo ObjectId, else search by slug
    let product;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(id).select(
        "_id name slug description brand category price compareAtPrice stock images status createdAt variants"
      );
    } else {
      product = await Product.findOne({ slug: id }).select(
        "_id name slug description brand category price compareAtPrice stock images status createdAt variants"
      );
    }

    // 1. If product does not exist in database (deleted or invalid)
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    // 2. Check if product's category is currently active
    const categoryDoc = await Category.findOne({ name: product.category });
    if (categoryDoc && !categoryDoc.isActive) {
      return res.status(400).json({
        success: false,
        isInactive: true,
        isCategoryInactive: true,
        category: product.category,
        message: `The ${product.category} collection is currently unavailable.`,
      });
    }

    // 3. If product exists but is set to Inactive by admin
    if (product.status === "Inactive") {
      return res.status(400).json({
        success: false,
        isInactive: true,
        message: "Product unavailable.",
      });
    }

    // 4. Retrieve approved review stats
    const ratingSummary = await Review.getProductRatingSummary(product._id);

    return res.status(200).json({
      success: true,
      product,
      ratingSummary,
    });
  } catch (error) {
    console.error("Get public product by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve product details.",
    });
  }
};

export {
  getPublicProducts,
  getPublicProductCollections,
  getPublicProductById,
};

export default {
  getPublicProducts,
  getPublicProductCollections,
  getPublicProductById,
};
