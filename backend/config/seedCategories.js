import Category from "../models/category.model.js";

const DEFAULT_CATEGORIES = [
  {
    name: "Men",
    slug: "men",
    description: "Bold, architectural fragrances tailored to masculine presence and timeless sophistication.",
    isActive: true,
  },
  {
    name: "Women",
    slug: "women",
    description: "Luminous, captivating compositions starring radiant florals and delicate luxury accords.",
    isActive: true,
  },
  {
    name: "Unisex",
    slug: "unisex",
    description: "Fragrance without boundaries. Fluid olfactory mastery balancing mineral freshness and warm musks.",
    isActive: true,
  },
];

const seedCategories = async () => {
  try {
    for (const cat of DEFAULT_CATEGORIES) {
      const existing = await Category.findOne({
        $or: [{ name: cat.name }, { slug: cat.slug }],
      });

      if (!existing) {
        await Category.create(cat);
        console.log(`✅ Category initialized: ${cat.name} (${cat.slug}) [Active: ${cat.isActive}]`);
      }
    }
  } catch (error) {
    console.error("❌ Category seed error:", error.message);
  }
};

export default seedCategories;
