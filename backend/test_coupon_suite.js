const mongoose = require("mongoose");
const dotenv = require("dotenv");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const User = require("./models/user.model");
const Product = require("./models/product.model");
const Cart = require("./models/cart.model");
const Order = require("./models/order.model");
const Coupon = require("./models/coupon.model");

const API_BASE = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failedCount++;
    throw new Error(message);
  }
}

async function runCouponSuite() {
  console.log("==================================================");
  console.log("FEXA COMPREHENSIVE COUPON SUITE (TESTS A - O)");
  console.log("==================================================");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB:", process.env.MONGO_URI);

  // Clean up any old test coupons
  await Coupon.deleteMany({ code: { $in: [
    "FEXA20", "SAVE10", "INVALIDTEST", "MINTEST", "MAXTEST", 
    "EXPIREDTEST", "INACTIVETEST", "FUTURETEST", "LIMITTEST", "PERUSERTEST",
    "RAZORPAYTEST", "FAILTEST", "CODTEST", "TAMPERTEST"
  ] } });

  // 1. Setup Admin and User
  let admin = await User.findOne({ email: "admin_coupon_test@fexa.com" });
  if (!admin) {
    admin = await User.create({
      name: "Admin Tester",
      email: "admin_coupon_test@fexa.com",
      password: "password123",
      role: "admin",
      isAdmin: true,
    });
  }
  const adminToken = jwt.sign({ id: admin._id, email: admin.email, role: "admin" }, JWT_SECRET, { expiresIn: "1d" });

  let customer = await User.findOne({ email: "customer_coupon_test@fexa.com" });
  if (!customer) {
    customer = await User.create({
      name: "Customer Tester",
      email: "customer_coupon_test@fexa.com",
      password: "password123",
      role: "user",
    });
  }
  const customerToken = jwt.sign({ id: customer._id, email: customer.email, role: "user" }, JWT_SECRET, { expiresIn: "1d" });

  // Saved address for customer
  const testAddress = {
    _id: new mongoose.Types.ObjectId(),
    fullName: "Customer Tester",
    phone: "9876543210",
    house: "Villa 101",
    street: "Rose Avenue",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    country: "India",
    label: "Home",
    isDefault: true,
  };
  customer.addresses = [testAddress];
  await customer.save();

  // Dedicated test perfume product with known variant pricing
  let product = await Product.findOne({ name: "FEXA Royal Elixir Test" });
  if (product) {
    product.variants = [
      { volumeMl: 50, sellingPrice: 2000, originalPrice: 2500, stock: 50, isAvailable: true },
      { volumeMl: 100, sellingPrice: 3500, originalPrice: 4200, stock: 50, isAvailable: true },
      { volumeMl: 200, sellingPrice: 6000, originalPrice: 7500, stock: 50, isAvailable: true },
    ];
    await product.save();
  } else {
    product = await Product.create({
      name: "FEXA Royal Elixir Test",
      slug: `fexa-royal-elixir-test-${Date.now()}`,
      brand: "FEXA Haute Parfumerie",
      description: "Artisanal extrait de parfum for coupon testing",
      category: "Unisex",
      price: 3500,
      stock: 150,
      status: "Active",
      variants: [
        { volumeMl: 50, sellingPrice: 2000, originalPrice: 2500, stock: 50, isAvailable: true },
        { volumeMl: 100, sellingPrice: 3500, originalPrice: 4200, stock: 50, isAvailable: true },
        { volumeMl: 200, sellingPrice: 6000, originalPrice: 7500, stock: 50, isAvailable: true },
      ],
      images: ["/uploads/test.jpg"],
    });
  }

  // ----------------------------------------------------
  // TEST A: CREATE COUPON IN ADMIN
  // ----------------------------------------------------
  console.log("\n>>> TEST A: Create Coupon in Admin...");
  const createRes = await fetch(`${API_BASE}/admin/coupons`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      code: "  fexa20  ", // tests trimming & uppercase normalization
      name: "FEXA Signature Offer",
      description: "Enjoy 20% off your perfume purchase",
      discountPercentage: 20,
      minimumOrderAmount: 1000,
      maximumDiscount: 2000,
      startDate: new Date(Date.now() - 3600000).toISOString(),
      expiryDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      usageLimit: 100,
      perUserLimit: 2,
      isActive: true,
    })
  });
  const createData = await createRes.json();
  console.log("createRes debug:", createRes.status, createData);
  assert(createRes.status === 201 && createData.success, "Admin coupon created with 201 status");
  assert(createData.coupon.code === "FEXA20", "Coupon code trimmed and normalized to uppercase 'FEXA20'");
  assert(createData.coupon.discountPercentage === 20, "Discount percentage is 20%");

  // Verify in MongoDB
  const dbCouponA = await Coupon.findOne({ code: "FEXA20" });
  assert(dbCouponA !== null, "Coupon FEXA20 verified in MongoDB database");

  // Duplicate code rejection
  const dupRes = await fetch(`${API_BASE}/admin/coupons`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      code: "FEXA20",
      discountPercentage: 15
    })
  });
  assert(dupRes.status === 400, "Duplicate coupon code correctly rejected with 400 Bad Request");

  // ----------------------------------------------------
  // TEST B: INVALID ADMIN VALUES
  // ----------------------------------------------------
  console.log("\n>>> TEST B: Invalid Admin Values...");
  const invalidCases = [
    { discountPercentage: 0, desc: "0% discount rejected" },
    { discountPercentage: -15, desc: "Negative percentage rejected" },
    { discountPercentage: 105, desc: "Percentage above 100% rejected" },
    { discountPercentage: "not_a_number", desc: "Non-numeric percentage rejected" },
    { code: "", discountPercentage: 20, desc: "Empty coupon code rejected" },
    { code: "BAD DATES", discountPercentage: 20, startDate: "2026-10-30", expiryDate: "2026-10-10", desc: "Start date after expiry date rejected" }
  ];

  for (const tc of invalidCases) {
    const res = await fetch(`${API_BASE}/admin/coupons`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        code: tc.code !== undefined ? tc.code : "INVALIDTEST",
        discountPercentage: tc.discountPercentage,
        startDate: tc.startDate,
        expiryDate: tc.expiryDate
      })
    });
    assert(res.status === 400, `Admin validation correctly rejected: ${tc.desc}`);
  }

  // ----------------------------------------------------
  // TEST C: VALID COUPON APPLICATION ON ELIGIBLE CART
  // ----------------------------------------------------
  console.log("\n>>> TEST C: Apply Valid Coupon to Eligible Cart...");
  // Populate cart with 100ml variant (price: 3500)
  const variant100 = product.variants.find(v => v.volumeMl === 100) || product.variants[0];
  let cart = await Cart.findOne({ user: customer._id });
  if (!cart) cart = new Cart({ user: customer._id, items: [] });
  cart.items = [{
    product: product._id,
    variantId: variant100._id.toString(),
    volumeMl: variant100.volumeMl,
    quantity: 1,
    unitPrice: variant100.price,
    lineTotal: variant100.price,
  }];
  await cart.save();

  const applyRes = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${customerToken}`
    },
    body: JSON.stringify({ couponCode: "fexa20" })
  });
  const applyData = await applyRes.json();
  console.log("applyRes debug:", applyRes.status, applyData);
  assert(applyRes.status === 200 && applyData.success, "Coupon applied with 200 OK");
  assert(applyData.coupon.code === "FEXA20", "Applied coupon code is FEXA20");
  assert(applyData.coupon.discountPercentage === 20, "Applied discount percentage is 20%");
  // 20% of 3500 = 700
  assert(applyData.coupon.discountAmount === 700, "Calculated discount is exactly ₹700 (20% of ₹3500)");
  assert(applyData.coupon.eligibleSubtotal === 3500, "Eligible subtotal is ₹3500");
  assert(applyData.calculation.subtotal - applyData.calculation.discountAmount === 2800, "Discounted subtotal before shipping is ₹2800");
  assert(applyData.calculation.totalAmount === 3050, "Final total including shipping is ₹3050");

  // ----------------------------------------------------
  // TEST D: STRICT ONE COUPON ONLY (NEVER COMBINED)
  // ----------------------------------------------------
  console.log("\n>>> TEST D: One Coupon Only Enforcement...");
  // Create second coupon SAVE10 (10%)
  await Coupon.create({
    code: "SAVE10",
    name: "Save 10 Percent",
    discountPercentage: 10,
    isActive: true,
    startDate: new Date(Date.now() - 3600000),
    expiryDate: new Date(Date.now() + 86400000 * 30),
  });

  // Apply SAVE10
  const applySave10Res = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${customerToken}`
    },
    body: JSON.stringify({ couponCode: "SAVE10" })
  });
  const applySave10Data = await applySave10Res.json();
  assert(applySave10Res.status === 200, "SAVE10 applied successfully");
  assert(applySave10Data.coupon.code === "SAVE10", "Active coupon is now SAVE10");
  // 10% of 3500 = 350
  assert(applySave10Data.coupon.discountAmount === 350, "Discount is ₹350, NOT ₹1050 (discounts are NEVER combined)");

  // Test submitting array of multiple codes to bypass
  const arrayRes = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${customerToken}`
    },
    body: JSON.stringify({ couponCode: ["FEXA20", "SAVE10"] })
  });
  assert(arrayRes.status === 400, "Multiple coupon codes array rejected with 400 Bad Request (strictly blocks combining coupons)");

  // ----------------------------------------------------
  // TEST E: REPLACE WITH INVALID COUPON PRESERVES EXISTING VALID COUPON
  // ----------------------------------------------------
  console.log("\n>>> TEST E: Replace with Invalid Coupon Preserves Existing...");
  // FEXA20 is currently active. Attempt to apply non-existent code
  const invalidApplyRes = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${customerToken}`
    },
    body: JSON.stringify({ couponCode: "NONEXISTENT999" })
  });
  assert(invalidApplyRes.status === 400 || invalidApplyRes.status === 404, "Invalid replacement code rejected by server");

  // In frontend state logic, previous coupon is preserved. Let's verify backend cart checkout with FEXA20 still succeeds
  const recheckRes = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${customerToken}`
    },
    body: JSON.stringify({ couponCode: "FEXA20" })
  });
  assert(recheckRes.status === 200, "Previous valid coupon FEXA20 remains valid and applicable");

  // ----------------------------------------------------
  // TEST F: MINIMUM ORDER REQUIREMENT
  // ----------------------------------------------------
  console.log("\n>>> TEST F: Minimum Order Requirement...");
  await Coupon.create({
    code: "MINTEST",
    name: "Min 4000 Order",
    discountPercentage: 20,
    minimumOrderAmount: 4000, // Requires 4000
    startDate: new Date(Date.now() - 3600000),
    expiryDate: new Date(Date.now() + 86400000 * 30),
    isActive: true,
  });

  // Current cart is 3500 (< 4000)
  const minFailRes = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${customerToken}`
    },
    body: JSON.stringify({ couponCode: "MINTEST" })
  });
  const minFailData = await minFailRes.json();
  console.log("minFailData debug:", minFailRes.status, minFailData);
  assert(minFailRes.status === 400 && minFailData.message.toLowerCase().includes("minimum"), "Coupon rejected when merchandise subtotal (₹3500) < minimum (₹4000)");

  // Increase cart to 2 flacons (2 * 3500 = 7000 >= 4000)
  cart.items[0].quantity = 2;
  cart.items[0].lineTotal = 7000;
  await cart.save();

  const minPassRes = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${customerToken}`
    },
    body: JSON.stringify({ couponCode: "MINTEST" })
  });
  const minPassData = await minPassRes.json();
  assert(minPassRes.status === 200 && minPassData.success, "Coupon accepted once merchandise subtotal reaches ₹7000");

  // Reset cart quantity back to 1 for subsequent tests
  cart.items[0].quantity = 1;
  cart.items[0].lineTotal = 3500;
  await cart.save();

  // ----------------------------------------------------
  // TEST G: MAXIMUM DISCOUNT CAP
  // ----------------------------------------------------
  console.log("\n>>> TEST G: Maximum Discount Cap...");
  await Coupon.create({
    code: "MAXTEST",
    name: "Max Discount Cap",
    discountPercentage: 50, // 50%
    maximumDiscount: 1000,  // Capped at 1000
    startDate: new Date(Date.now() - 3600000),
    expiryDate: new Date(Date.now() + 86400000 * 30),
    isActive: true,
  });

  // On cart of 3500, 50% would be 1750, but capped at 1000
  const maxCapRes = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${customerToken}`
    },
    body: JSON.stringify({ couponCode: "MAXTEST" })
  });
  const maxCapData = await maxCapRes.json();
  assert(maxCapRes.status === 200, "MAXTEST applied successfully");
  assert(maxCapData.coupon.discountAmount === 1000, "Discount capped at maximum configured discount of ₹1000 (50% of ₹3500 = ₹1750 -> capped to ₹1000)");

  // ----------------------------------------------------
  // TEST H: EXPIRY AND STATUS VALIDATIONS
  // ----------------------------------------------------
  console.log("\n>>> TEST H: Inactive and Expired Coupons...");
  await Coupon.create({
    code: "EXPIREDTEST",
    discountPercentage: 15,
    startDate: new Date(Date.now() - 7200000),
    expiryDate: new Date(Date.now() - 3600000), // Expired 1 hour ago
    isActive: true,
  });
  await Coupon.create({
    code: "INACTIVETEST",
    discountPercentage: 15,
    startDate: new Date(Date.now() - 3600000),
    expiryDate: new Date(Date.now() + 86400000 * 30),
    isActive: false, // Inactive
  });
  await Coupon.create({
    code: "FUTURETEST",
    discountPercentage: 15,
    startDate: new Date(Date.now() + 86400000), // Starts tomorrow
    expiryDate: new Date(Date.now() + 86400000 * 30),
    isActive: true,
  });

  const expRes = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken}` },
    body: JSON.stringify({ couponCode: "EXPIREDTEST" })
  });
  assert(expRes.status === 400, "Expired coupon correctly rejected");

  const inactRes = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken}` },
    body: JSON.stringify({ couponCode: "INACTIVETEST" })
  });
  assert(inactRes.status === 400, "Inactive coupon correctly rejected");

  const futRes = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken}` },
    body: JSON.stringify({ couponCode: "FUTURETEST" })
  });
  assert(futRes.status === 400, "Not-yet-active coupon correctly rejected");

  // ----------------------------------------------------
  // TEST I: USAGE LIMITS (GLOBAL & PER-USER)
  // ----------------------------------------------------
  console.log("\n>>> TEST I: Usage Limits (Global & Per-User)...");
  await Coupon.create({
    code: "LIMITTEST",
    discountPercentage: 10,
    startDate: new Date(Date.now() - 3600000),
    expiryDate: new Date(Date.now() + 86400000 * 30),
    isActive: true,
    usageLimit: 1,
    usedCount: 1, // Already reached global limit
  });
  const limitRes = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken}` },
    body: JSON.stringify({ couponCode: "LIMITTEST" })
  });
  assert(limitRes.status === 400, "Global usage limit exhaustion correctly rejected");

  await Coupon.create({
    code: "PERUSERTEST",
    discountPercentage: 10,
    startDate: new Date(Date.now() - 3600000),
    expiryDate: new Date(Date.now() + 86400000 * 30),
    isActive: true,
    perUserLimit: 1,
    userRedemptions: [{ user: customer._id, orderId: new mongoose.Types.ObjectId() }], // User already redeemed once
  });
  const perUserRes = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken}` },
    body: JSON.stringify({ couponCode: "PERUSERTEST" })
  });
  assert(perUserRes.status === 400, "Per-user usage limit exhaustion correctly rejected");

  // ----------------------------------------------------
  // TEST J: VARIANT PRICING INTEGRITY
  // ----------------------------------------------------
  console.log("\n>>> TEST J: Variant Pricing Integrity...");
  // Test 50ml (₹2000) vs 200ml (₹6000)
  const variant50 = product.variants.find(v => v.volumeMl === 50);
  const variant200 = product.variants.find(v => v.volumeMl === 200);

  cart.items = [{
    product: product._id,
    variantId: variant50._id.toString(),
    volumeMl: 50,
    quantity: 1,
    unitPrice: variant50.price,
    lineTotal: variant50.price
  }];
  await cart.save();

  const apply50Res = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken}` },
    body: JSON.stringify({ couponCode: "FEXA20" })
  });
  const apply50Data = await apply50Res.json();
  // 20% of 2000 = 400
  assert(apply50Data.coupon.discountAmount === 400, "50ml flacon (₹2000) calculated discount is ₹400");

  cart.items = [{
    product: product._id,
    variantId: variant200._id.toString(),
    volumeMl: 200,
    quantity: 1,
    unitPrice: variant200.price,
    lineTotal: variant200.price
  }];
  await cart.save();

  const apply200Res = await fetch(`${API_BASE}/coupons/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken}` },
    body: JSON.stringify({ couponCode: "FEXA20" })
  });
  const apply200Data = await apply200Res.json();
  // 20% of 6000 = 1200
  assert(apply200Data.coupon.discountAmount === 1200, "200ml flacon (₹6000) calculated discount is ₹1200");

  // ----------------------------------------------------
  // TEST K: RAZORPAY PAYMENT SUCCESS WITH COUPON DISCOUNT
  // ----------------------------------------------------
  console.log("\n>>> TEST K: Razorpay Payment Success Flow...");
  await Coupon.create({
    code: "RAZORPAYTEST",
    discountPercentage: 25, // 25% of 6000 = 1500 discount
    startDate: new Date(Date.now() - 3600000),
    expiryDate: new Date(Date.now() + 86400000 * 30),
    isActive: true,
  });

  // Step 1: Create Razorpay Order
  const rzpOrderRes = await fetch(`${API_BASE}/orders/razorpay/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken}` },
    body: JSON.stringify({
      addressId: testAddress._id.toString(),
      couponCode: "RAZORPAYTEST"
    })
  });
  const rzpOrderData = await rzpOrderRes.json();
  assert(rzpOrderRes.status === 200 && rzpOrderData.success, "Razorpay order created with coupon discount");
  // Subtotal = 6000. Discount = 1500. Subtotal >= 5000 so shipping is complimentary (0). Final total = 4500.
  // In paise: 4500 * 100 = 450000 paise.
  assert(rzpOrderData.amount === 450000, `Razorpay charges exact discounted amount in paise: 450000 (Expected 450000, received ${rzpOrderData.amount})`);

  const internalOrderId = rzpOrderData.orderId;
  const razorpayOrderId = rzpOrderData.razorpayOrderId;

  // Step 2: Generate authentic Razorpay signature
  const mockPaymentId = `pay_coupon_test_${Date.now()}`;
  const hmac = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET);
  hmac.update(`${razorpayOrderId}|${mockPaymentId}`);
  const authenticSignature = hmac.digest("hex");

  // Step 3: Verify Payment and Commit Order
  const verifyRes = await fetch(`${API_BASE}/orders/razorpay/verify-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken}` },
    body: JSON.stringify({
      orderId: internalOrderId,
      addressId: testAddress._id.toString(),
      paymentMethod: "Razorpay",
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: mockPaymentId,
      razorpay_signature: authenticSignature
    })
  });
  const verifyData = await verifyRes.json();
  assert(verifyRes.status === 201 && verifyData.success, "Razorpay payment verified and order created (201 Created)");
  assert(verifyData.order.paymentStatus === "Paid", "Order paymentStatus is 'Paid'");
  assert(verifyData.order.totalAmount === 4500, "Order totalAmount is exactly ₹4500");
  assert(verifyData.order.discountAmount === 1500, "Order records discountAmount ₹1500");
  assert(verifyData.order.couponCode === "RAZORPAYTEST", "Order records couponCode snapshot 'RAZORPAYTEST'");

  // Verify Coupon usedCount in DB incremented exactly once
  const dbCouponK = await Coupon.findOne({ code: "RAZORPAYTEST" });
  assert(dbCouponK.usedCount === 1, "Coupon usedCount incremented to 1 upon verified payment");
  const userUses = dbCouponK.userRedemptions.filter(r => r.user.toString() === customer._id.toString()).length;
  assert(userUses === 1, "Customer recorded in userRedemptions exactly once");

  // ----------------------------------------------------
  // TEST L: RAZORPAY PAYMENT FAILURE (NO PREMATURE CONSUMPTION)
  // ----------------------------------------------------
  console.log("\n>>> TEST L: Razorpay Payment Failure Handling...");
  // Re-populate cart with fresh DB fetch
  cart = await Cart.findOne({ user: customer._id });
  cart.items = [{
    product: product._id,
    variantId: variant100._id.toString(),
    volumeMl: 100,
    quantity: 1,
    unitPrice: variant100.sellingPrice || variant100.price,
    lineTotal: variant100.sellingPrice || variant100.price
  }];
  await cart.save();

  await Coupon.create({
    code: "FAILTEST",
    discountPercentage: 20,
    startDate: new Date(Date.now() - 3600000),
    expiryDate: new Date(Date.now() + 86400000 * 30),
    isActive: true,
    usageLimit: 1,
  });

  const failInitRes = await fetch(`${API_BASE}/orders/razorpay/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken}` },
    body: JSON.stringify({
      addressId: testAddress._id.toString(),
      couponCode: "FAILTEST"
    })
  });
  const failInitData = await failInitRes.json();
  assert(failInitRes.status === 200, "Order initialized for failure test");

  // Record payment failure callback
  const reportFailRes = await fetch(`${API_BASE}/orders/razorpay/payment-failed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken}` },
    body: JSON.stringify({
      orderId: failInitData.orderId,
      razorpayOrderId: failInitData.razorpayOrderId,
      code: "BAD_CARD",
      description: "Insufficient funds"
    })
  });
  assert(reportFailRes.status === 200, "Payment failure recorded safely on backend");

  // Verify coupon was NOT prematurely redeemed
  const dbFailCoupon = await Coupon.findOne({ code: "FAILTEST" });
  assert(dbFailCoupon.usedCount === 0, "Coupon usedCount remains 0 on payment failure (no premature consumption)");

  // ----------------------------------------------------
  // TEST M: CASH ON DELIVERY WITH COUPON & IDEMPOTENCY
  // ----------------------------------------------------
  console.log("\n>>> TEST M: Cash on Delivery with Coupon...");
  await Coupon.create({
    code: "CODTEST",
    discountPercentage: 20, // 20% of 3500 = 700. Subtotal 3500 + shipping 250 - 700 = 3050.
    startDate: new Date(Date.now() - 3600000),
    expiryDate: new Date(Date.now() + 86400000 * 30),
    isActive: true,
  });

  const codRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken}` },
    body: JSON.stringify({
      addressId: testAddress._id.toString(),
      paymentMethod: "COD",
      couponCode: "CODTEST"
    })
  });
  const codData = await codRes.json();
  assert(codRes.status === 201 && codData.success, "COD order created with coupon discount");
  assert(codData.order.totalAmount === 3050, "COD order total is exactly ₹3050 (3500 - 700 + 250)");
  assert(codData.order.discountAmount === 700, "COD order records ₹700 coupon discount");
  assert(codData.order.couponCode === "CODTEST", "COD order snapshot stores 'CODTEST'");

  const dbCodCoupon = await Coupon.findOne({ code: "CODTEST" });
  assert(dbCodCoupon.usedCount === 1, "COD coupon usage incremented to 1 upon order confirmation");

  // Test repeat order request idempotency with same orderId
  const dupCodRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken}` },
    body: JSON.stringify({
      orderId: codData.order._id,
      addressId: testAddress._id.toString(),
      paymentMethod: "COD",
      couponCode: "CODTEST"
    })
  });
  assert(dupCodRes.status === 200 || dupCodRes.status === 201, "Repeat order submission handled safely");
  const dbCodCoupon2 = await Coupon.findOne({ code: "CODTEST" });
  assert(dbCodCoupon2.usedCount === 1, "Duplicate order request did NOT double-increment coupon usage");

  // ----------------------------------------------------
  // TEST N: DISCOUNT TAMPERING PROTECTION
  // ----------------------------------------------------
  console.log("\n>>> TEST N: Discount Tampering Protection...");
  // Re-populate cart with fresh DB fetch
  cart = await Cart.findOne({ user: customer._id });
  cart.items = [{
    product: product._id,
    variantId: variant100._id.toString(),
    volumeMl: 100,
    quantity: 1,
    unitPrice: variant100.sellingPrice || variant100.price,
    lineTotal: variant100.sellingPrice || variant100.price
  }];
  await cart.save();

  await Coupon.create({
    code: "TAMPERTEST",
    discountPercentage: 10, // Actual 10% = 350
    startDate: new Date(Date.now() - 3600000),
    expiryDate: new Date(Date.now() + 86400000 * 30),
    isActive: true,
  });

  // Client maliciously attempts to send discountAmount: 3000 and totalAmount: 100
  const tamperRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken}` },
    body: JSON.stringify({
      addressId: testAddress._id.toString(),
      paymentMethod: "COD",
      couponCode: "TAMPERTEST",
      discountAmount: 3000, // Forged
      totalAmount: 100       // Forged
    })
  });
  const tamperData = await tamperRes.json();
  assert(tamperRes.status === 201, "Order processed through server authority");
  assert(tamperData.order.discountAmount === 350, "Server ignored forged discount and enforced authentic ₹350 (10% of ₹3500)");
  assert(tamperData.order.totalAmount === 3400, "Server ignored forged total and enforced authentic ₹3400 (3500 - 350 + 250)");

  // ----------------------------------------------------
  // TEST O: REGRESSION & ADMIN STATS
  // ----------------------------------------------------
  console.log("\n>>> TEST O: Regression & Admin Stats Verification...");
  const adminListRes = await fetch(`${API_BASE}/admin/coupons`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${adminToken}` }
  });
  const adminListData = await adminListRes.json();
  assert(adminListRes.status === 200 && adminListData.success, "GET /api/admin/coupons returned 200 OK");
  assert(adminListData.stats !== undefined, "Admin stats object present");
  assert(adminListData.stats.totalCoupons >= 5, "Admin stats reflects totalCoupons correctly");
  assert(adminListData.stats.totalRedemptions >= 2, "Admin stats reflects totalRedemptions correctly");

  // Customer offers discovery
  const offersRes = await fetch(`${API_BASE}/coupons/available`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${customerToken}` }
  });
  const offersData = await offersRes.json();
  assert(offersRes.status === 200 && offersData.success, "GET /api/coupons/available returned 200 OK");
  assert(Array.isArray(offersData.coupons), "Public available offers returned as array");
  const hasExpiredInPublic = offersData.coupons.some(c => c.code === "EXPIREDTEST");
  assert(!hasExpiredInPublic, "Expired coupons are excluded from customer offers discovery");

  console.log("\n==================================================");
  console.log(`ALL TESTS PASSED: ${passedCount} / ${passedCount + failedCount} ASSERTIONS`);
  console.log("==================================================");

  await mongoose.disconnect();
}

runCouponSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
