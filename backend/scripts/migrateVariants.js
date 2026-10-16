/**
 * FEXA Atelier — Variant Data Normalization & Migration Script
 * 
 * Safely migrates legacy products to the variant schema and normalizes
 * existing variant documents to restore authentic product availability:
 * - Preserves existing prices, original prices, and stock counts
 * - Sets variant isAvailable to true for active products with positive stock
 * - Synchronizes root price and total stock
 * - Safe and idempotent: can be rerun safely without duplicating data
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const Product = require("../models/product.model");

const runMigration = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/fexa-project";
    console.log("Connecting to MongoDB:", mongoUri);
    await mongoose.connect(mongoUri);

    const products = await Product.find({});
    console.log(`Found ${products.length} products to evaluate.\n`);

    let updatedCount = 0;
    let legacyMigratedCount = 0;
    let untouchedCount = 0;

    for (const prod of products) {
      let modified = false;

      // 1. LEGACY PRODUCTS WITHOUT VARIANTS
      if (!prod.variants || prod.variants.length === 0) {
        const legacyPrice = Number(prod.price) || 0;
        const legacyCompare = Number(prod.compareAtPrice) || legacyPrice;
        const legacyStock = Number(prod.stock) || 0;
        const isAvailable = prod.status !== "Inactive" && legacyStock > 0;

        prod.variants = [
          {
            volumeMl: 100, // Standard FEXA flacon volume
            sellingPrice: legacyPrice,
            originalPrice: legacyCompare,
            stock: legacyStock,
            isAvailable,
          },
        ];

        legacyMigratedCount++;
        modified = true;
        console.log(`✓ [LEGACY MIGRATED] "${prod.name}" (${prod._id}) -> 100ml @ ₹${legacyPrice}, Stock: ${legacyStock}, isAvailable: ${isAvailable}`);
      } else {
        // 2. EXISTING PRODUCTS WITH VARIANTS
        // Check for erroneous isAvailable: false where stock > 0 and status is not Inactive
        for (const variant of prod.variants) {
          if (variant.isAvailable === false && variant.stock > 0 && prod.status !== "Inactive") {
            variant.isAvailable = true;
            modified = true;
            console.log(`✓ [RESTORED AVAILABILITY] "${prod.name}" (${prod._id}) - Variant ${variant.volumeMl}ml (Stock: ${variant.stock}) -> isAvailable: true`);
          }
        }
      }

      if (modified) {
        // Recalculate root price, compareAtPrice, and stock
        const activeVariants = prod.variants.filter((v) => v.isAvailable !== false);
        const pool = activeVariants.length > 0 ? activeVariants : prod.variants;
        const minVariant = pool.reduce(
          (min, cur) => (cur.sellingPrice < min.sellingPrice ? cur : min),
          pool[0]
        );

        prod.price = minVariant.sellingPrice;
        prod.compareAtPrice = minVariant.originalPrice || 0;
        prod.stock = prod.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

        if (prod.stock === 0 && prod.status === "Active") {
          prod.status = "Out of Stock";
        } else if (prod.stock > 0 && prod.status === "Out of Stock") {
          prod.status = "Active";
        }

        await prod.save();
        updatedCount++;
      } else {
        untouchedCount++;
        console.log(`- [UNCHANGED] "${prod.name}" (${prod._id}) - Variants: ${prod.variants.length}, Stock: ${prod.stock}, Status: ${prod.status}`);
      }
    }

    console.log("\n==========================================");
    console.log("Migration Summary:");
    console.log(`Total Evaluated: ${products.length}`);
    console.log(`Legacy Migrated: ${legacyMigratedCount}`);
    console.log(`Updated / Restored: ${updatedCount}`);
    console.log(`Untouched / Already Valid: ${untouchedCount}`);
    console.log("==========================================");

  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  }
};

runMigration();
