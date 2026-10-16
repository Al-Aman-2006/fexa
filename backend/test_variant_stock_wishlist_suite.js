/**
 * Automated Verification Suite for FEXA Perfume E-Commerce
 * Tests:
 * - TEST A: Available Product Add-to-Cart
 * - TEST B: Out-of-Stock Product (Add-to-cart rejected, Wishlist accepted)
 * - TEST C: Multiple Variants of Same Perfume (Separate Cart Lines)
 * - TEST D: Legacy Product Compatibility
 * - TEST E: Wishlist Persistence & State Synchronization
 * - TEST F: Admin Stock Update & Purchasing Restoration
 * - TEST G: Security (Nonexistent Variant ID & Manipulated Price Rejection)
 * - TEST H: Regression across APIs
 */

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "./.env") });

const Product = require("./models/product.model");
const Cart = require("./models/cart.model");
const User = require("./models/user.model");

const BASE_URL = "http://localhost:5000";

async function runTestSuite() {
  console.log("=== STARTING COMPREHENSIVE FEXA TEST SUITE ===\n");
  await mongoose.connect(process.env.MONGO_URI);

  // Setup test user
  let testUser = await User.findOne({ email: "test_suite_user@fexa.com" });
  if (!testUser) {
    testUser = await User.create({
      name: "Test Atelier User",
      email: "test_suite_user@fexa.com",
      password: "Password123!",
      role: "user",
      emailVerified: true,
      wishlist: [],
    });
  } else {
    testUser.wishlist = [];
    await testUser.save();
  }

  // Clear test user's cart
  await Cart.deleteOne({ user: testUser._id });

  const token = jwt.sign(
    { id: testUser._id.toString(), email: testUser.email, role: testUser.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  const authHeaders = {
    "Content-Type": "application/json",
    Cookie: `token=${token}`,
    Authorization: `Bearer ${token}`,
  };

  let passedTests = 0;
  let totalTests = 8;

  // ----------------------------------------------------
  // TEST A: AVAILABLE PRODUCT
  // ----------------------------------------------------
  console.log(">>> RUNNING TEST A: Available Product Add to Cart...");
  const inStockProduct = await Product.findOne({
    status: "Active",
    "variants.0": { $exists: true },
    "variants.0.stock": { $gt: 0 },
    "variants.0.isAvailable": true,
  });

  if (!inStockProduct) {
    throw new Error("No active product with positive variant stock found for TEST A.");
  }

  const variantA = inStockProduct.variants[0];
  const resA = await fetch(`${BASE_URL}/api/cart/items`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      productId: inStockProduct._id.toString(),
      variantId: variantA._id.toString(),
      quantity: 1,
    }),
  });
  const dataA = await resA.json();

  if (resA.status === 200 && dataA.success && dataA.cart) {
    const itemA = dataA.cart.items.find(
      (i) => i.productId.toString() === inStockProduct._id.toString()
    );
    if (
      itemA &&
      itemA.variantId.toString() === variantA._id.toString() &&
      itemA.price === variantA.sellingPrice &&
      itemA.quantity === 1
    ) {
      console.log(`✓ TEST A PASSED: Added ${inStockProduct.name} (${variantA.volumeMl}ml @ ₹${variantA.sellingPrice}) successfully.`);
      passedTests++;
    } else {
      console.error("✗ TEST A FAILED: Cart item attributes mismatch", itemA);
    }
  } else {
    console.error("✗ TEST A FAILED:", resA.status, dataA);
  }

  // ----------------------------------------------------
  // TEST B: OUT-OF-STOCK PRODUCT
  // ----------------------------------------------------
  console.log("\n>>> RUNNING TEST B: Out-of-Stock Product (Cart rejected, Wishlist accepted)...");
  // Create or set a temporary out-of-stock product
  let oosProduct = await Product.findOne({ name: "TEST Atelier OOS Perfume" });
  if (!oosProduct) {
    oosProduct = await Product.create({
      name: "TEST Atelier OOS Perfume",
      slug: "test-atelier-oos-perfume",
      description: "Temporary zero-stock fragrance for inventory safety testing.",
      brand: "FEXA",
      category: "Unisex",
      price: 2900,
      compareAtPrice: 3500,
      stock: 0,
      status: "Out of Stock",
      images: [],
      variants: [
        {
          volumeMl: 50,
          sellingPrice: 2900,
          originalPrice: 3500,
          stock: 0, // Genuine 0 stock
          isAvailable: true,
        },
      ],
    });
  } else {
    oosProduct.variants[0].stock = 0;
    oosProduct.status = "Out of Stock";
    oosProduct.stock = 0;
    await oosProduct.save();
  }

  // Attempt to add OOS product to cart
  const resB_cart = await fetch(`${BASE_URL}/api/cart/items`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      productId: oosProduct._id.toString(),
      variantId: oosProduct.variants[0]._id.toString(),
      quantity: 1,
    }),
  });
  const dataB_cart = await resB_cart.json();

  // Attempt to add OOS product to wishlist
  const resB_wish = await fetch(`${BASE_URL}/api/wishlist/items`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      productId: oosProduct._id.toString(),
    }),
  });
  const dataB_wish = await resB_wish.json();

  const cartRejected = resB_cart.status === 400 && !dataB_cart.success;
  const wishAccepted = (resB_wish.status === 200 || resB_wish.status === 201) && dataB_wish.success;

  if (cartRejected && wishAccepted) {
    console.log("✓ TEST B PASSED: Out-of-stock cart add correctly rejected (400), wishlist addition allowed.");
    passedTests++;
  } else {
    console.error("✗ TEST B FAILED: cartRejected =", cartRejected, "wishAccepted =", wishAccepted);
  }

  // ----------------------------------------------------
  // TEST C: DIFFERENT VARIANTS (50ml & 100ml as separate cart lines)
  // ----------------------------------------------------
  console.log("\n>>> RUNNING TEST C: Separate Cart Lines for Multiple Variants...");
  let multiVariantProd = await Product.findOne({ name: "TEST Multi-Variant Velvet" });
  if (!multiVariantProd) {
    multiVariantProd = await Product.create({
      name: "TEST Multi-Variant Velvet",
      slug: "test-multi-variant-velvet",
      description: "Multi-size test extrait.",
      brand: "FEXA",
      category: "Unisex",
      price: 1500,
      compareAtPrice: 1800,
      stock: 30,
      status: "Active",
      images: [],
      variants: [
        { volumeMl: 50, sellingPrice: 1500, originalPrice: 1800, stock: 10, isAvailable: true },
        { volumeMl: 100, sellingPrice: 2800, originalPrice: 3200, stock: 20, isAvailable: true },
      ],
    });
  }

  const var50 = multiVariantProd.variants.find((v) => v.volumeMl === 50);
  const var100 = multiVariantProd.variants.find((v) => v.volumeMl === 100);

  // Add 50ml
  await fetch(`${BASE_URL}/api/cart/items`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      productId: multiVariantProd._id.toString(),
      variantId: var50._id.toString(),
      quantity: 1,
    }),
  });

  // Add 100ml
  const resC2 = await fetch(`${BASE_URL}/api/cart/items`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      productId: multiVariantProd._id.toString(),
      variantId: var100._id.toString(),
      quantity: 1,
    }),
  });
  const dataC2 = await resC2.json();

  const linesForProduct = dataC2.cart.items.filter(
    (i) => i.productId.toString() === multiVariantProd._id.toString()
  );

  if (linesForProduct.length === 2) {
    const has50 = linesForProduct.some((i) => i.volumeMl === 50 && i.price === 1500);
    const has100 = linesForProduct.some((i) => i.volumeMl === 100 && i.price === 2800);
    if (has50 && has100) {
      console.log("✓ TEST C PASSED: 50ml and 100ml variants saved as distinct cart items with individual pricing.");
      passedTests++;
    } else {
      console.error("✗ TEST C FAILED: Variant details mismatch", linesForProduct);
    }
  } else {
    console.error("✗ TEST C FAILED: Expected 2 separate lines, got", linesForProduct.length);
  }

  // ----------------------------------------------------
  // TEST D: LEGACY PRODUCTS (Products without variants array)
  // ----------------------------------------------------
  console.log("\n>>> RUNNING TEST D: Legacy Product Compatibility...");
  let legacyProd = await Product.findOne({ name: "TEST Pure Legacy Fragrance" });
  if (!legacyProd) {
    // Insert raw document without variants
    const rawDoc = {
      name: "TEST Pure Legacy Fragrance",
      slug: "test-pure-legacy-fragrance",
      description: "Legacy unmigrated product formulation.",
      brand: "FEXA",
      category: "Men",
      price: 1999,
      compareAtPrice: 2499,
      stock: 15,
      status: "Active",
      images: [],
    };
    const insertRes = await mongoose.connection.db.collection("products").insertOne(rawDoc);
    legacyProd = await Product.findById(insertRes.insertedId);
  }

  // Attempt to add legacy product to cart
  const resD = await fetch(`${BASE_URL}/api/cart/items`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      productId: legacyProd._id.toString(),
      quantity: 1,
    }),
  });
  const dataD = await resD.json();

  if (resD.status === 200 && dataD.success) {
    const itemD = dataD.cart.items.find((i) => i.productId.toString() === legacyProd._id.toString());
    if (itemD && itemD.price === 1999 && itemD.stock === 15) {
      console.log("✓ TEST D PASSED: Legacy product added to cart safely using root price and stock fallback.");
      passedTests++;
    } else {
      console.error("✗ TEST D FAILED: Item not found in cart or pricing mismatch", itemD);
    }
  } else {
    console.error("✗ TEST D FAILED:", resD.status, dataD);
  }

  // ----------------------------------------------------
  // TEST E: WISHLIST PERSISTENCE & SYNCHRONIZATION
  // ----------------------------------------------------
  console.log("\n>>> RUNNING TEST E: Wishlist Persistence & Removal...");
  const targetWishProduct = inStockProduct;
  
  // 1. Add to wishlist
  const resE_add = await fetch(`${BASE_URL}/api/wishlist/items`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ productId: targetWishProduct._id.toString() }),
  });
  const dataE_add = await resE_add.json();

  // 2. Fetch fresh wishlist
  const resE_get = await fetch(`${BASE_URL}/api/wishlist`, {
    method: "GET",
    headers: authHeaders,
  });
  const dataE_get = await resE_get.json();

  const isSaved = dataE_get.wishlist.some(
    (item) => item.productId.toString() === targetWishProduct._id.toString()
  );

  // 3. Remove from wishlist
  const resE_del = await fetch(`${BASE_URL}/api/wishlist/items/${targetWishProduct._id.toString()}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  const dataE_del = await resE_del.json();

  const isRemoved = !dataE_del.wishlist.some(
    (item) => item.productId.toString() === targetWishProduct._id.toString()
  );

  if (isSaved && isRemoved) {
    console.log("✓ TEST E PASSED: Wishlist item successfully persisted, verified via GET, and cleanly removed.");
    passedTests++;
  } else {
    console.error("✗ TEST E FAILED: isSaved =", isSaved, "isRemoved =", isRemoved);
  }

  // ----------------------------------------------------
  // TEST F: STOCK UPDATE RESTORING PURCHASABILITY
  // ----------------------------------------------------
  console.log("\n>>> RUNNING TEST F: Stock Update in Admin/DB Restoring Purchasability...");
  // Take oosProduct (which was 0 stock) and restore stock to 10
  oosProduct.variants[0].stock = 10;
  oosProduct.variants[0].isAvailable = true;
  oosProduct.stock = 10;
  oosProduct.status = "Active";
  await oosProduct.save();

  const resF = await fetch(`${BASE_URL}/api/cart/items`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      productId: oosProduct._id.toString(),
      variantId: oosProduct.variants[0]._id.toString(),
      quantity: 1,
    }),
  });
  const dataF = await resF.json();

  if (resF.status === 200 && dataF.success) {
    console.log("✓ TEST F PASSED: Previously OOS perfume became immediately purchasable upon stock update.");
    passedTests++;
  } else {
    console.error("✗ TEST F FAILED:", resF.status, dataF);
  }

  // ----------------------------------------------------
  // TEST G: SECURITY (Nonexistent Variant ID & Price Tampering)
  // ----------------------------------------------------
  console.log("\n>>> RUNNING TEST G: Security & Tampering Resistance...");
  const fakeVariantId = new mongoose.Types.ObjectId().toString();

  // 1. Fake Variant ID
  const resG_fake = await fetch(`${BASE_URL}/api/cart/items`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      productId: inStockProduct._id.toString(),
      variantId: fakeVariantId,
      quantity: 1,
    }),
  });
  const dataG_fake = await resG_fake.json();

  // 2. Manipulated Price injection attempt
  const resG_tamper = await fetch(`${BASE_URL}/api/cart/items`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      productId: inStockProduct._id.toString(),
      variantId: inStockProduct.variants[0]._id.toString(),
      quantity: 1,
      price: 1, // Tampered price: ₹1
    }),
  });
  const dataG_tamper = await resG_tamper.json();
  const addedItem = dataG_tamper.cart?.items?.find(
    (i) => i.productId.toString() === inStockProduct._id.toString()
  );

  const fakeRejected = resG_fake.status === 400;
  const priceHonored = addedItem ? addedItem.price === inStockProduct.variants[0].sellingPrice : false;

  if (fakeRejected && priceHonored) {
    console.log("✓ TEST G PASSED: Nonexistent variant ID rejected (400), submitted price ignored in favor of DB price.");
    passedTests++;
  } else {
    console.error("✗ TEST G FAILED: fakeRejected =", fakeRejected, "priceHonored =", priceHonored);
  }

  // ----------------------------------------------------
  // TEST H: REGRESSION ACROSS CORE API ENDPOINTS
  // ----------------------------------------------------
  console.log("\n>>> RUNNING TEST H: Regression Testing Public & Auth APIs...");
  const [resPublic, resCollections, resSingle] = await Promise.all([
    fetch(`${BASE_URL}/api/products?limit=5`),
    fetch(`${BASE_URL}/api/products/collections`),
    fetch(`${BASE_URL}/api/products/${inStockProduct._id.toString()}`),
  ]);

  const [dataPublic, dataCollections, dataSingle] = await Promise.all([
    resPublic.json(),
    resCollections.json(),
    resSingle.json(),
  ]);

  const publicOk = resPublic.status === 200 && dataPublic.success && dataPublic.products.length > 0;
  const collOk = resCollections.status === 200 && dataCollections.success;
  const singleOk = resSingle.status === 200 && dataSingle.success && dataSingle.product._id;

  if (publicOk && collOk && singleOk) {
    console.log("✓ TEST H PASSED: Public catalogue, collections summary, and product details APIs working flawlessly.");
    passedTests++;
  } else {
    console.error("✗ TEST H FAILED: publicOk =", publicOk, "collOk =", collOk, "singleOk =", singleOk);
  }

  // Clean up temporary test documents
  await Product.deleteMany({
    name: { $in: ["TEST Atelier OOS Perfume", "TEST Multi-Variant Velvet", "TEST Pure Legacy Fragrance"] },
  });
  await User.deleteOne({ email: "test_suite_user@fexa.com" });
  await Cart.deleteOne({ user: testUser._id });

  console.log("\n==========================================");
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  console.log("==========================================");

  await mongoose.disconnect();
  process.exit(passedTests === totalTests ? 0 : 1);
}

runTestSuite().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
