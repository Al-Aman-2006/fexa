const mongoose = require("mongoose");
const Product = require("../models/product.model");

// Normalizer for category matching (Men, Women, Unisex)
const normalizeCategory = (cat) => {
  if (!cat) return null;
  const lower = cat.toString().trim().toLowerCase();
  if (lower === "men") return "Men";
  if (lower === "women") return "Women";
  if (lower === "unisex") return "Unisex";
  return null;
};

// ========================================================
// GET PUBLIC PRODUCTS (Filtered by category, search, sort, pagination)
// STRICT: Only returns Active or Out of Stock products (never Inactive)
// ========================================================
const getPublicProducts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const rawCategory = req.query.category ? req.query.category.trim() : null;
    const search = req.query.search ? req.query.search.trim() : "";
    const sortParam = (req.query.sort || "featured").toLowerCase().trim();
    const excludeId = req.query.excludeId ? req.query.excludeId.trim() : null;

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
      if (canonicalCategory) {
        // Safe case-insensitive regex match against category
        queryFilter.category = { $regex: new RegExp(`^${canonicalCategory}$`, "i") };
      } else {
        // If an invalid category was explicitly requested, match nothing
        queryFilter.category = "__INVALID__";
      }
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

    // Determine sorting criteria:
    // 1. featured / default -> latest/featured order
    // 2. latest -> Newest Arrivals
    // 3. price-low -> Representative variant price ASC
    // 4. price-high -> Representative variant price DESC
    // 5. name-asc / name -> Alphabetical A-Z
    // 6. name-desc -> Alphabetical Z-A
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
    const [aggregateResult, menCount, womenCount, unisexCount, allCount] = await Promise.all([
      aggregateQuery,
      Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Men" }),
      Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Women" }),
      Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Unisex" }),
      Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] } }),
    ]);

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
        all: allCount,
        men: menCount,
        women: womenCount,
        unisex: unisexCount,
      },
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
// ========================================================
const getPublicProductCollections = async (req, res) => {
  try {
    const safeProjection = "_id name slug description brand category price compareAtPrice stock images status createdAt variants";

    // Query active products for each category
    const [menProducts, womenProducts, unisexProducts] = await Promise.all([
      Product.find({ status: { $in: ["Active", "Out of Stock"] }, category: "Men" })
        .select(safeProjection)
        .sort({ createdAt: -1 })
        .limit(8),
      Product.find({ status: { $in: ["Active", "Out of Stock"] }, category: "Women" })
        .select(safeProjection)
        .sort({ createdAt: -1 })
        .limit(8),
      Product.find({ status: { $in: ["Active", "Out of Stock"] }, category: "Unisex" })
        .select(safeProjection)
        .sort({ createdAt: -1 })
        .limit(8),
    ]);

    const [menCount, womenCount, unisexCount, totalCount] = await Promise.all([
      Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Men" }),
      Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Women" }),
      Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] }, category: "Unisex" }),
      Product.countDocuments({ status: { $in: ["Active", "Out of Stock"] } }),
    ]);

    return res.status(200).json({
      success: true,
      collections: {
        men: {
          title: "Men's Collection",
          subtitle: "Defined by Presence. Rich smoked woods, amber resins, and Italian leather.",
          count: menCount,
          products: menProducts,
        },
        women: {
          title: "Women's Collection",
          subtitle: "Crafted for Elegance. Radiant florals, Grasse rose, and powdery white amber.",
          count: womenCount,
          products: womenProducts,
        },
        unisex: {
          title: "Unisex Collection",
          subtitle: "Fragrance Without Boundaries. Crisp bergamot, mineral sea salt, and velvet cashmeran.",
          count: unisexCount,
          products: unisexProducts,
        },
      },
      counts: {
        all: totalCount,
        men: menCount,
        women: womenCount,
        unisex: unisexCount,
      },
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

    // 2. If product exists but is set to Inactive by admin
    if (product.status === "Inactive") {
      return res.status(400).json({
        success: false,
        isInactive: true,
        message: "Product unavailable.",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Get public product by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve product details.",
    });
  }
};

module.exports = {
  getPublicProducts,
  getPublicProductCollections,
  getPublicProductById,
};
