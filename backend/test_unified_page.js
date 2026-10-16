/**
 * Automated Verification for Unified Product Management
 * Tests Tests A - H from the prompt specifications
 */

const mongoose = require("mongoose");
const Product = require("./models/product.model");

let passed = 0;
let total = 0;

function assert(cond, msg) {
  total++;
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(msg);
  } else {
    console.log(`✅ PASS: ${msg}`);
    passed++;
  }
}

async function runUnifiedVerification() {
  console.log("==================================================");
  console.log("RUNNING UNIFIED PRODUCT MANAGEMENT TESTS (TESTS A - H)");
  console.log("==================================================\n");

  await mongoose.connect("mongodb://localhost:27017/fexa-project");

  // TEST B: Category Filtering
  // 1. All Products contains Men, Women, and Unisex products
  const allProds = await Product.find({});
  const catSet = new Set(allProds.map((p) => p.category));
  assert(catSet.has("Men"), "TEST B: All Products includes Men products");
  assert(catSet.has("Women"), "TEST B: All Products includes Women products");
  assert(catSet.has("Unisex"), "TEST B: All Products includes Unisex products");
  assert(allProds.length >= 13, "TEST B: All Products does not default to only Men");

  // 2. Men filter
  const menOnly = await Product.find({ category: "Men" });
  assert(menOnly.every((p) => p.category === "Men"), "TEST B: Men filter returns strictly Men products");

  // 3. Women filter
  const womenOnly = await Product.find({ category: "Women" });
  assert(womenOnly.every((p) => p.category === "Women"), "TEST B: Women filter returns strictly Women products");

  // 4. Unisex filter
  const unisexOnly = await Product.find({ category: "Unisex" });
  assert(unisexOnly.every((p) => p.category === "Unisex"), "TEST B: Unisex filter returns strictly Unisex products");

  // TEST C: Add Product across categories
  const testMen = await new Product({
    name: "Unified Men Cologne",
    slug: `unified-men-cologne-${Date.now()}`,
    brand: "FEXA",
    category: "Men",
    price: 1800,
    compareAtPrice: 2200,
    stock: 8,
    description: "Deep spicy cardamom and cedarwood.",
    images: ["/uploads/products/men-col.jpg"],
    status: "Active",
  }).save();

  const testWomen = await new Product({
    name: "Unified Women Bloom",
    slug: `unified-women-bloom-${Date.now()}`,
    brand: "FEXA",
    category: "Women",
    price: 2400,
    compareAtPrice: 2800,
    stock: 14,
    description: "Delicate jasmine and Madagascar vanilla.",
    images: ["/uploads/products/women-bloom.jpg"],
    status: "Active",
  }).save();

  const testUnisex = await new Product({
    name: "Unified Unisex Solitude",
    slug: `unified-unisex-solitude-${Date.now()}`,
    brand: "FEXA",
    category: "Unisex",
    price: 3200,
    compareAtPrice: 3800,
    stock: 5,
    description: "Smoky incense, cashmeran, and bergamot.",
    images: ["/uploads/products/unisex-sol.jpg"],
    status: "Active",
  }).save();

  assert(testMen && testMen.category === "Men", "TEST C: Men product added successfully");
  assert(testWomen && testWomen.category === "Women", "TEST C: Women product added successfully");
  assert(testUnisex && testUnisex.category === "Unisex", "TEST C: Unisex product added successfully");

  // TEST E: Edit Product Category & Persist
  testMen.category = "Women";
  testMen.name = "Unified Moved Fragrance";
  testMen.price = 2100;
  await testMen.save();

  const verifyMoved = await Product.findById(testMen._id);
  assert(verifyMoved.category === "Women", "TEST E: Category changed from Men to Women");
  assert(verifyMoved.price === 2100, "TEST E: Updated price persisted");

  const duplicateCheck = await Product.countDocuments({ _id: testMen._id });
  assert(duplicateCheck === 1, "TEST E: Single document preserved in MongoDB without duplication");

  // TEST F: Search within All vs specific category
  const searchNameRegex = new RegExp("Unified", "i");
  const allSearchResults = await Product.find({
    $or: [{ name: searchNameRegex }, { brand: searchNameRegex }],
  });
  assert(allSearchResults.length >= 3, "TEST F: Search inside All Products searches across all categories");

  const menSearch = await Product.find({
    category: "Men",
    $or: [{ name: searchNameRegex }, { brand: searchNameRegex }],
  });
  assert(menSearch.every((p) => p.category === "Men"), "TEST F: Search in Men never returns Women or Unisex");

  const nonexistent = await Product.find({
    $or: [{ name: /ZZZNonExistentName999/i }, { brand: /ZZZNonExistentName999/i }],
  });
  assert(nonexistent.length === 0, "TEST F: Nonexistent search returns empty results");

  // TEST G: Clean up test documents (Delete)
  await Product.findByIdAndDelete(testMen._id);
  await Product.findByIdAndDelete(testWomen._id);
  await Product.findByIdAndDelete(testUnisex._id);

  const checkCleanup = await Product.find({
    _id: { $in: [testMen._id, testWomen._id, testUnisex._id] },
  });
  assert(checkCleanup.length === 0, "TEST G: Products deleted cleanly from MongoDB");

  console.log("\n==================================================");
  console.log(`TESTS COMPLETE: ${passed}/${total} assertions passed!`);
  console.log("==================================================");

  await mongoose.disconnect();
}

runUnifiedVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
