/**
 * Comprehensive Variant & Stock End-to-End Test Suite for FEXA
 * Tests all 12 specified requirements from Section 17.
 */

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Product = require("./models/product.model");
const Cart = require("./models/cart.model");
const Order = require("./models/order.model");
const User = require("./models/user.model");

const API_BASE = "http://localhost:5000/api";
let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ PASS: ${message}`);
    passedCount++;
  }
}

async function runAllTests() {
  console.log("==================================================");
  console.log("RUNNING FEXA PERFUME VARIANTS & STOCK E2E TEST SUITE");
  console.log("==================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for E2E tests.\n");

  // Setup test user
  let testUser = await User.findOne({ email: "variant_test_user@fexa.com" });
  if (!testUser) {
    testUser = await User.create({
      name: "Variant Tester",
      email: "variant_test_user@fexa.com",
      password: "HashedPassword123!",
      role: "user",
      emailVerified: true,
      isBlocked: false,
    });
  }

  const userToken = jwt.sign(
    { id: testUser._id, email: testUser.email, role: "user" },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
  const userHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${userToken}`,
  };

  // Setup test admin
  let testAdmin = await User.findOne({ role: "admin" });
  if (!testAdmin) {
    testAdmin = await User.create({
      name: "Admin Tester",
      email: "variant_admin@fexa.com",
      password: "HashedPassword123!",
      role: "admin",
      emailVerified: true,
      isBlocked: false,
    });
  }
  const adminToken = jwt.sign(
    { id: testAdmin._id, email: testAdmin.email, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
  const adminHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  // Clean up any old test products & test user carts/orders
  await Product.deleteMany({ name: { $in: ["Test Velvet Oud", "Test Midnight Rose"] } });
  await Cart.deleteMany({ user: testUser._id });
  await Order.deleteMany({ user: testUser._id });

  let product1Id;
  let variant30Id;
  let variant50Id;
  let variant100Id;

  let product2Id;
  let p2Variant50Id;
  let p2Variant100Id;

  // =========================================================================
  // TEST 1 — ADD PRODUCT WITH MULTIPLE SIZES
  // =========================================================================
  console.log("--- TEST 1: ADD PRODUCT WITH MULTIPLE SIZES ---");
  {
    // Create perfume: 30ml (₹799, stock 10), 50ml (₹1299, stock 5), 100ml (₹2199, stock 2)
    const product1 = new Product({
      name: "Test Velvet Oud",
      brand: "FEXA",
      category: "Unisex",
      description: "A rich oud fragrance with notes of damask rose and smoky wood.",
      status: "Active",
      images: ["/uploads/products/test-velvet-oud.jpg"],
      variants: [
        { volumeMl: 30, sellingPrice: 799, originalPrice: 999, stock: 10, isAvailable: true },
        { volumeMl: 50, sellingPrice: 1299, originalPrice: 1499, stock: 5, isAvailable: true },
        { volumeMl: 100, sellingPrice: 2199, originalPrice: 2499, stock: 2, isAvailable: true },
      ],
    });

    await product1.save();
    product1Id = product1._id.toString();

    // Verify product saved in MongoDB
    const fetched = await Product.findById(product1Id);
    assert(fetched !== null, "TEST 1: Product 1 saved in MongoDB");
    assert(fetched.variants.length === 3, "TEST 1: Saved exactly 3 variants");

    const v30 = fetched.variants.find((v) => v.volumeMl === 30);
    const v50 = fetched.variants.find((v) => v.volumeMl === 50);
    const v100 = fetched.variants.find((v) => v.volumeMl === 100);

    assert(v30 && v30.sellingPrice === 799 && v30.stock === 10, "TEST 1: 30ml has price ₹799 and stock 10");
    assert(v50 && v50.sellingPrice === 1299 && v50.stock === 5, "TEST 1: 50ml has price ₹1299 and stock 5");
    assert(v100 && v100.sellingPrice === 2199 && v100.stock === 2, "TEST 1: 100ml has price ₹2199 and stock 2");

    // Check automated pre-validate aggregations
    assert(fetched.price === 799, "TEST 1: Aggregated min price is ₹799");
    assert(fetched.stock === 17, "TEST 1: Aggregated total stock is 17 (10 + 5 + 2)");

    variant30Id = v30._id.toString();
    variant50Id = v50._id.toString();
    variant100Id = v100._id.toString();
  }

  // =========================================================================
  // TEST 2 — DIFFERENT PRODUCTS, DIFFERENT SIZES
  // =========================================================================
  console.log("\n--- TEST 2: DIFFERENT PRODUCTS, DIFFERENT SIZES ---");
  {
    // Create second perfume with only 50ml and 100ml
    const product2 = new Product({
      name: "Test Midnight Rose",
      brand: "FEXA",
      category: "Women",
      description: "Sensual Turkish rose and patchouli.",
      status: "Active",
      images: ["/uploads/products/test-midnight-rose.jpg"],
      variants: [
        { volumeMl: 50, sellingPrice: 1599, originalPrice: 1899, stock: 8, isAvailable: true },
        { volumeMl: 100, sellingPrice: 2699, originalPrice: 2999, stock: 4, isAvailable: true },
      ],
    });

    await product2.save();
    product2Id = product2._id.toString();

    const fetched2 = await Product.findById(product2Id);
    assert(fetched2 !== null, "TEST 2: Product 2 saved in MongoDB");
    assert(fetched2.variants.length === 2, "TEST 2: Product 2 has strictly 2 variants");

    const has30 = fetched2.variants.some((v) => v.volumeMl === 30);
    const has200 = fetched2.variants.some((v) => v.volumeMl === 200);
    assert(!has30, "TEST 2: Product 2 does not have 30ml");
    assert(!has200, "TEST 2: Product 2 does not have 200ml");

    p2Variant50Id = fetched2.variants.find((v) => v.volumeMl === 50)._id.toString();
    p2Variant100Id = fetched2.variants.find((v) => v.volumeMl === 100)._id.toString();
  }

  // =========================================================================
  // TEST 3 — EDIT VARIANTS
  // =========================================================================
  console.log("\n--- TEST 3: EDIT VARIANTS ---");
  {
    // Edit Product 1: Change 50ml price from ₹1299 to ₹1399, stock from 5 to 7
    const productToEdit = await Product.findById(product1Id);
    const targetVariant = productToEdit.variants.find((v) => v.volumeMl === 50);
    targetVariant.sellingPrice = 1399;
    targetVariant.stock = 7;

    await productToEdit.save();

    // Re-fetch from MongoDB to verify persistence
    const reloaded = await Product.findById(product1Id);
    const updatedV50 = reloaded.variants.find((v) => v.volumeMl === 50);
    assert(updatedV50.sellingPrice === 1399, "TEST 3: 50ml updated price ₹1399 persisted");
    assert(updatedV50.stock === 7, "TEST 3: 50ml updated stock 7 persisted");

    // Verify other variants remain untouched
    const untouchedV30 = reloaded.variants.find((v) => v.volumeMl === 30);
    const untouchedV100 = reloaded.variants.find((v) => v.volumeMl === 100);
    assert(untouchedV30.sellingPrice === 799 && untouchedV30.stock === 10, "TEST 3: 30ml variant untouched");
    assert(untouchedV100.sellingPrice === 2199 && untouchedV100.stock === 2, "TEST 3: 100ml variant untouched");
  }

  // =========================================================================
  // TEST 4 — SIZE SELECTION (PUBLIC API & DETAILS COMPLIANCE)
  // =========================================================================
  console.log("\n--- TEST 4: SIZE SELECTION ---");
  {
    // Fetch product details from the public API
    const response = await fetch(`${API_BASE}/products/${product1Id}`);
    const data = await response.json();
    assert(data.success === true, "TEST 4: Public API returns product details");

    const p = data.product;
    assert(Array.isArray(p.variants) && p.variants.length === 3, "TEST 4: Variants array included in public payload");

    // Client-side selection simulation
    const sel30 = p.variants.find((v) => v.volumeMl === 30);
    assert(sel30 && sel30.sellingPrice === 799 && sel30.stock === 10, "TEST 4: 30ml shows price ₹799, stock 10");

    const sel50 = p.variants.find((v) => v.volumeMl === 50);
    assert(sel50 && sel50.sellingPrice === 1399 && sel50.stock === 7, "TEST 4: 50ml shows price ₹1399, stock 7");

    const sel100 = p.variants.find((v) => v.volumeMl === 100);
    assert(sel100 && sel100.sellingPrice === 2199 && sel100.stock === 2, "TEST 4: 100ml shows price ₹2199, stock 2");
  }

  // =========================================================================
  // TEST 5 — CART VARIANTS
  // =========================================================================
  console.log("\n--- TEST 5: CART VARIANTS ---");
  {
    // Add 50ml of Test Velvet Oud to cart (quantity 2)
    const addV50Res = await fetch(`${API_BASE}/cart/items`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        productId: product1Id,
        variantId: variant50Id,
        volumeMl: 50,
        quantity: 2,
      }),
    });
    const addV50Data = await addV50Res.json();
    assert(addV50Data.success === true, "TEST 5: Added 50ml to cart");

    // Add 100ml of same perfume to cart (quantity 1)
    const addV100Res = await fetch(`${API_BASE}/cart/items`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        productId: product1Id,
        variantId: variant100Id,
        volumeMl: 100,
        quantity: 1,
      }),
    });
    const addV100Data = await addV100Res.json();
    assert(addV100Data.success === true, "TEST 5: Added 100ml of same perfume to cart");

    // Fetch user cart
    const cartRes = await fetch(`${API_BASE}/cart`, { headers: userHeaders });
    const cartData = await cartRes.json();
    assert(cartData.success === true, "TEST 5: Fetched cart successfully");
    const cartObj = cartData.cart || cartData;
    assert(cartObj.items.length === 2, "TEST 5: Cart contains exactly 2 separate cart lines");

    const line50 = cartObj.items.find((i) => i.volumeMl === 50);
    const line100 = cartObj.items.find((i) => i.volumeMl === 100);

    assert(line50 && line50.quantity === 2 && line50.price === 1399, "TEST 5: 50ml line has qty 2 and price ₹1399");
    assert(line100 && line100.quantity === 1 && line100.price === 2199, "TEST 5: 100ml line has qty 1 and price ₹2199");

    // Verify subtotal calculation: (1399 * 2) + (2199 * 1) = 2798 + 2199 = 4997
    assert(cartObj.subtotal === 4997, "TEST 5: Server calculated accurate subtotal (₹4,997)");
  }

  // =========================================================================
  // TEST 6 — QUANTITY LIMIT (MAX 5 & VARIANT STOCK BOUND)
  // =========================================================================
  console.log("\n--- TEST 6: QUANTITY LIMIT ---");
  {
    // Try adding quantity 6 for 30ml (stock is 10, but max limit is 5)
    const add6Res = await fetch(`${API_BASE}/cart/items`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        productId: product1Id,
        variantId: variant30Id,
        volumeMl: 30,
        quantity: 6,
      }),
    });
    const add6Data = await add6Res.json();
    assert(add6Data.success === false, "TEST 6: Quantity 6 rejected by backend (exceeds max 5)");

    // Try adding quantity 3 for 100ml (100ml has stock 2, already has 1 in cart)
    const addExceedStockRes = await fetch(`${API_BASE}/cart/items`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        productId: product1Id,
        variantId: variant100Id,
        volumeMl: 100,
        quantity: 2, // Total would be 1 + 2 = 3 > stock 2
      }),
    });
    const addExceedStockData = await addExceedStockRes.json();
    assert(addExceedStockData.success === false, "TEST 6: Adding beyond variant available stock rejected");
  }

  // =========================================================================
  // TEST 7 — OUT OF STOCK VARIANT
  // =========================================================================
  console.log("\n--- TEST 7: OUT OF STOCK VARIANT ---");
  {
    // Set 30ml variant stock to 0
    await Product.updateOne(
      { _id: product1Id, "variants._id": variant30Id },
      { $set: { "variants.$.stock": 0 } }
    );

    // Attempt to add 30ml (stock 0) to cart
    const addOosRes = await fetch(`${API_BASE}/cart/items`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        productId: product1Id,
        variantId: variant30Id,
        volumeMl: 30,
        quantity: 1,
      }),
    });
    const addOosData = await addOosRes.json();
    assert(addOosData.success === false, "TEST 7: Out-of-stock size cannot be added to cart");

    // Verify 50ml (which has stock 7) can still be purchased/updated
    const cart = await Cart.findOne({ user: testUser._id });
    const item50 = cart.items.find((i) => i.variantId.toString() === variant50Id);
    assert(item50 !== undefined, "TEST 7: In-stock 50ml variant remains in cart and purchasable");
  }

  // =========================================================================
  // TEST 8 — CHECKOUT (PURCHASE SELECTED VARIANT)
  // =========================================================================
  console.log("\n--- TEST 8: CHECKOUT ---");
  {
    // Clear user cart and add exactly one variant for clean checkout test: 50ml, qty 2
    await Cart.deleteMany({ user: testUser._id });
    await fetch(`${API_BASE}/cart/items`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        productId: product1Id,
        variantId: variant50Id,
        volumeMl: 50,
        quantity: 2,
      }),
    });

    const orderPayload = {
      items: [
        {
          productId: product1Id,
          variantId: variant50Id,
          volumeMl: 50,
          quantity: 2,
        },
      ],
      shippingAddress: {
        fullName: "Aman Aziz",
        phone: "9876543210",
        street: "Marine Drive",
        city: "Kochi",
        state: "Kerala",
        pincode: "682001",
        country: "India",
      },
      paymentMethod: "COD",
    };

    const orderRes = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify(orderPayload),
    });
    const orderData = await orderRes.json();
    assert(orderData.success === true, "TEST 8: Order created successfully via checkout");
    assert(orderData.order !== undefined, "TEST 8: Order object returned");

    const order = orderData.order;
    assert(order.items.length === 1, "TEST 8: Order has 1 item");
    assert(order.items[0].volumeMl === 50, "TEST 8: Order item preserves 50ml size");
    assert(order.items[0].unitPrice === 1399, "TEST 8: Order item preserves unit price ₹1399");
    assert(order.items[0].quantity === 2, "TEST 8: Order item preserves quantity 2");
    assert(order.items[0].lineTotal === 2798, "TEST 8: Order item line total is ₹2798");
    assert(order.subtotal === 2798, "TEST 8: Order subtotal matches items line total ₹2798");
    assert(order.totalAmount === 2798 + order.shippingCost, "TEST 8: Grand total matches items + shipping");
  }

  // =========================================================================
  // TEST 9 — STOCK DEDUCTION
  // =========================================================================
  console.log("\n--- TEST 9: STOCK DEDUCTION ---");
  {
    // The previous order purchased 2 units of 50ml (which started at stock 7 in TEST 3)
    // 50ml stock must now be 7 - 2 = 5
    // 100ml stock must remain 2
    // 30ml stock must remain 0
    const p1AfterOrder = await Product.findById(product1Id);
    const v50After = p1AfterOrder.variants.find((v) => v.volumeMl === 50);
    const v100After = p1AfterOrder.variants.find((v) => v.volumeMl === 100);
    const v30After = p1AfterOrder.variants.find((v) => v.volumeMl === 30);

    assert(v50After.stock === 5, "TEST 9: 50ml stock decreased from 7 to 5 (by exactly 2)");
    assert(v100After.stock === 2, "TEST 9: 100ml stock untouched at 2");
    assert(v30After.stock === 0, "TEST 9: 30ml stock untouched at 0");
  }

  // =========================================================================
  // TEST 10 — PRICE SECURITY
  // =========================================================================
  console.log("\n--- TEST 10: PRICE SECURITY ---");
  {
    // Malicious client sends fake unitPrice: 1 and lineTotal: 1 for 100ml (real price ₹2199)
    const spoofedOrderPayload = {
      items: [
        {
          productId: product1Id,
          variantId: variant100Id,
          volumeMl: 100,
          quantity: 1,
          unitPrice: 1, // Malicious spoof
          lineTotal: 1,
        },
      ],
      shippingAddress: {
        fullName: "Price Hacker",
        phone: "9876543210",
        street: "Hacker Way",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      },
      paymentMethod: "COD",
    };

    const spoofRes = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify(spoofedOrderPayload),
    });
    const spoofData = await spoofRes.json();
    assert(spoofData.success === true, "TEST 10: Order processed safely");
    assert(
      spoofData.order.items[0].unitPrice === 2199,
      "TEST 10: Spoofed price overridden with real MongoDB price ₹2199"
    );
    assert(
      spoofData.order.subtotal === 2199,
      "TEST 10: Server-calculated subtotal is ₹2199, not ₹1"
    );
  }

  // =========================================================================
  // TEST 11 — HISTORICAL ORDERS IMMUTABILITY
  // =========================================================================
  console.log("\n--- TEST 11: HISTORICAL ORDERS IMMUTABILITY ---");
  {
    // Find the latest order for test user
    const lastOrder = await Order.findOne({ user: testUser._id }).sort({ createdAt: -1 });
    const originalPriceInOrder = lastOrder.items[0].unitPrice;
    assert(originalPriceInOrder === 2199, "TEST 11: Snapshot unit price before edit is ₹2199");

    // Admin updates the 100ml variant price to ₹3500 in MongoDB
    await Product.updateOne(
      { _id: product1Id, "variants._id": variant100Id },
      { $set: { "variants.$.sellingPrice": 3500 } }
    );

    // Verify historical order still retains ₹2199
    const orderRefetched = await Order.findById(lastOrder._id);
    assert(
      orderRefetched.items[0].unitPrice === 2199,
      "TEST 11: Historical order retains original purchase price ₹2199 after product price change"
    );
    assert(
      orderRefetched.items[0].volumeMl === 100,
      "TEST 11: Historical order retains original size (100ml)"
    );
  }

  // =========================================================================
  // TEST 12 — REGRESSION (COLLECTIONS, SEARCH, CART, ADMIN)
  // =========================================================================
  console.log("\n--- TEST 12: REGRESSION TESTS ---");
  {
    // 1. Collections endpoint returns active products with variants
    const colRes = await fetch(`${API_BASE}/products?category=All`);
    const colData = await colRes.json();
    assert(colData.success === true, "TEST 12: Collections endpoint responds successfully");
    assert(colData.products.length > 0, "TEST 12: Products list populated");

    // 2. Search endpoint works across products with variants
    const searchRes = await fetch(`${API_BASE}/products?search=Velvet`);
    const searchData = await searchRes.json();
    assert(searchData.success === true, "TEST 12: Search endpoint works");
    assert(
      searchData.products.some((p) => p.name === "Test Velvet Oud"),
      "TEST 12: Test Velvet Oud found in search"
    );

    // 3. Admin product list works and returns category counts
    const adminListRes = await fetch(`${API_BASE}/admin/products`, { headers: adminHeaders });
    const adminListData = await adminListRes.json();
    assert(adminListData.success === true, "TEST 12: Admin products list accessible");
    assert(adminListData.categoryCounts !== undefined, "TEST 12: Admin category counts present");

    // 4. Cart removal works cleanly
    // Add item to cart first
    await fetch(`${API_BASE}/cart/items`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        productId: product1Id,
        variantId: variant50Id,
        volumeMl: 50,
        quantity: 1,
      }),
    });

    const cartToClear = await Cart.findOne({ user: testUser._id });
    if (cartToClear && cartToClear.items.length > 0) {
      const itemToRemove = cartToClear.items[0];
      const removeRes = await fetch(`${API_BASE}/cart/items/${itemToRemove._id}`, {
        method: "DELETE",
        headers: userHeaders,
      });
      const removeData = await removeRes.json();
      assert(removeData.success === true, "TEST 12: Cart item removed cleanly");
    }

    // 5. Clean up test products and user
    await Product.deleteMany({ name: { $in: ["Test Velvet Oud", "Test Midnight Rose"] } });
    await Cart.deleteMany({ user: testUser._id });
    await Order.deleteMany({ user: testUser._id });
    await User.deleteOne({ email: "variant_test_user@fexa.com" });
    console.log("Cleaned up test fixtures.");
  }

  console.log("\n==================================================");
  console.log(`TEST SUITE RESULTS: ${passedCount}/${totalCount} assertions passed!`);
  console.log("==================================================\n");

  await mongoose.disconnect();
  process.exit(0);
}

runAllTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
