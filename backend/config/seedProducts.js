const mongoose = require("mongoose");
const Product = require("../models/product.model");
require("dotenv").config();

const sampleProducts = [
  // MEN'S PERFUMES
  {
    name: "Noir Oud Absolu",
    slug: "noir-oud-absolu",
    description: "Deep Cambodian agarwood steeped in smoky birch, dark amber resins, and Italian bergamot. An intensely magnetic formulation engineered for evening presence.",
    brand: "FEXA",
    category: "Men",
    price: 3800,
    compareAtPrice: 4500,
    stock: 24,
    status: "Active",
    images: [],
  },
  {
    name: "Santal Impérial",
    slug: "santal-imperial",
    description: "Creamy Mysore sandalwood harmonized with crushed cardamom, violet leaf, and dry Virginia cedarwood. Quiet architectural masculinity with timeless sophistication.",
    brand: "FEXA",
    category: "Men",
    price: 4200,
    compareAtPrice: 5000,
    stock: 18,
    status: "Active",
    images: [],
  },
  {
    name: "Vétiver Cuir",
    slug: "vetiver-cuir",
    description: "Earthy Haitian vetiver enveloped in soft Tuscan leather, nutmeg, and clean grapefruit zest. A commanding signature for the discerning gentleman.",
    brand: "FEXA",
    category: "Men",
    price: 3400,
    compareAtPrice: 4000,
    stock: 12,
    status: "Active",
    images: [],
  },
  {
    name: "Bois De Cèdre Nocturne",
    slug: "bois-de-cedre-nocturne",
    description: "Midnight cedarwood fused with smoked frankincense, black pepper, and dark labdanum resin.",
    brand: "FEXA",
    category: "Men",
    price: 3100,
    compareAtPrice: 3600,
    stock: 0, // Test Out of Stock
    status: "Out of Stock",
    images: [],
  },

  // WOMEN'S PERFUMES
  {
    name: "Rose Impériale Extrait",
    slug: "rose-imperiale-extrait",
    description: "Precious Centifolia roses harvested at dawn in Grasse, blended with sparkling lychee, powdery white amber, and velvety Damask nectar.",
    brand: "FEXA",
    category: "Women",
    price: 4600,
    compareAtPrice: 5400,
    stock: 20,
    status: "Active",
    images: [],
  },
  {
    name: "Jasmin De Grasse",
    slug: "jasmin-de-grasse",
    description: "Night-blooming royal jasmine illuminated with Sicilian neroli, bourbon vanilla pod, and ethereal cashmeran.",
    brand: "FEXA",
    category: "Women",
    price: 3900,
    compareAtPrice: 4400,
    stock: 15,
    status: "Active",
    images: [],
  },
  {
    name: "Lilac Céleste Extrait",
    slug: "lilac-celeste-extrait",
    description: "Dew-drenched French lilacs kissed with pink pepper, white musk, and delicate solar aldehydes.",
    brand: "FEXA",
    category: "Women",
    price: 3600,
    compareAtPrice: 4200,
    stock: 22,
    status: "Active",
    images: [],
  },
  {
    name: "Velvet Orchid Nectar",
    slug: "velvet-orchid-nectar",
    description: "Exotic black orchid infused with warm golden honey, creamy sandalwood, and Madagascar vanilla orchid.",
    brand: "FEXA",
    category: "Women",
    price: 4100,
    compareAtPrice: 4800,
    stock: 8,
    status: "Active",
    images: [],
  },

  // UNISEX PERFUMES
  {
    name: "L'Ambre Solaire Extrait",
    slug: "lambre-solaire-extrait",
    description: "Solar golden amber balanced with mineral sea salt crystals, crisp bergamot zest, and luminous cedar. An enigmatic scent designed for individuality without boundaries.",
    brand: "FEXA",
    category: "Unisex",
    price: 4400,
    compareAtPrice: 5200,
    stock: 30,
    status: "Active",
    images: [],
  },
  {
    name: "Thé Noir & Musk",
    slug: "the-noir-musk",
    description: "Rare black tea infusions layered with dry fig, white tobacco leaf, and crystalline clean musk.",
    brand: "FEXA",
    category: "Unisex",
    price: 3700,
    compareAtPrice: 4200,
    stock: 19,
    status: "Active",
    images: [],
  },
  {
    name: "Bergamote Minérale",
    slug: "bergamote-minerale",
    description: "Calabrian bergamot infused with ocean spray, pink sea salt, aquatic driftwood, and white sage.",
    brand: "FEXA",
    category: "Unisex",
    price: 3500,
    compareAtPrice: 4000,
    stock: 25,
    status: "Active",
    images: [],
  },
];

const seedProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for seeding...");

    for (const item of sampleProducts) {
      const exists = await Product.findOne({ slug: item.slug });
      if (!exists) {
        await Product.create(item);
        console.log(`Created product: ${item.name} (${item.category})`);
      } else {
        console.log(`Product already exists: ${item.name}`);
      }
    }

    console.log("Product seeding completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
};

if (require.main === module) {
  seedProducts();
}

module.exports = seedProducts;
