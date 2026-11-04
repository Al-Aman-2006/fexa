import Category from "../models/category.model.js";
import Product from "../models/product.model.js";

const DEFAULT_CATEGORIES = [
  {
    name: "Men",
    slug: "men",
    description: "Bold, architectural fragrances tailored to masculine presence and timeless sophistication.",
    parentCategory: null,
    isActive: true,
  },
  {
    name: "Women",
    slug: "women",
    description: "Luminous, captivating compositions starring radiant florals and delicate luxury accords.",
    parentCategory: null,
    isActive: true,
  },
  {
    name: "Unisex",
    slug: "unisex",
    description: "Fragrance without boundaries. Fluid olfactory mastery balancing mineral freshness and warm musks.",
    parentCategory: null,
    isActive: true,
  },
];

const seedCategories = async () => {
  try {
    // 1. Safe Index Migration: Drop legacy global unique index on name if present
    try {
      const existingIndexes = await Category.collection.indexes();
      const hasLegacyNameIndex = existingIndexes.some((idx) => idx.name === "name_1" && idx.unique);
      if (hasLegacyNameIndex) {
        await Category.collection.dropIndex("name_1");
        console.log("ℹ️ Dropped legacy global unique index name_1 to allow subcategories under different parents.");
      }
    } catch (e) {
      // Index might not exist or already dropped
    }

    await Category.syncIndexes();

    // 2. Seed Default Parent Categories
    const categoryDocMap = {};
    for (const cat of DEFAULT_CATEGORIES) {
      let doc = await Category.findOne({
        parentCategory: null,
        $or: [{ name: cat.name }, { slug: cat.slug }],
      });

      if (!doc) {
        doc = await Category.create(cat);
        console.log(`✅ Parent Category initialized: ${cat.name} (${cat.slug})`);
      }
      categoryDocMap[cat.name] = doc;
    }

    // 3. Migrate existing products: Ensure parentCategory ObjectId is linked
    const unlinkedProducts = await Product.find({
      $or: [{ parentCategory: null }, { parentCategory: { $exists: false } }],
    });

    if (unlinkedProducts.length > 0) {
      let migratedCount = 0;
      for (const prod of unlinkedProducts) {
        const parentDoc = categoryDocMap[prod.category] || (await Category.findOne({ name: prod.category, parentCategory: null }));
        if (parentDoc) {
          prod.parentCategory = parentDoc._id;
          await prod.save();
          migratedCount++;
        }
      }
      if (migratedCount > 0) {
        console.log(`✅ Safely linked ${migratedCount} existing products to their parent category references.`);
      }
    }
  } catch (error) {
    console.error("❌ Category seed/migration error:", error.message);
  }
};

export default seedCategories;
