/**
 * Comprehensive Test Suite: Checkout with Saved Profile Addresses
 * Tests all 7 required scenarios from Section 10:
 * - TEST A: User with one saved address
 * - TEST B: User with multiple saved addresses
 * - TEST C: User with a default address auto-selection
 * - TEST D: User without saved addresses (empty state & rejection)
 * - TEST E: Address ownership security (rejecting another user's address ID)
 * - TEST F: Address edited after order (immutable snapshot preservation)
 * - TEST G: Checkout regression (perfume variants, stock, cart)
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

function getAuthHeader(user) {
  const token = jwt.sign(
    { id: user._id.toString(), role: user.role || "user" },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Cookie: `token=${token}`,
  };
}

async function runTestSuite() {
  console.log("==================================================");
  console.log("FEXA CHECKOUT WITH SAVED PROFILE ADDRESSES TEST SUITE");
  console.log("==================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.\n");

  // Setup product for checkout testing
  const product = await Product.findOne({
    status: "Active",
    "variants.stock": { $gte: 10 },
  });
  assert(product !== null, "Found active product with variants for testing");
  const testVariant = product.variants.find((v) => v.stock >= 10);
  assert(testVariant !== null, `Selected variant ${testVariant.volumeMl} ml`);

  // ==============================================================
  // TEST A: USER WITH ONE SAVED ADDRESS
  // ==============================================================
  console.log("\n>>> RUNNING TEST A: User with one saved address...");
  await User.deleteOne({ email: "checkout_test_user_a@fexa.com" });
  const userA = await User.create({
    name: "Eleanor Vance",
    email: "checkout_test_user_a@fexa.com",
    password: "hashedpassword123",
    phone: "9876543210",
    addresses: [
      {
        label: "Home",
        fullName: "Eleanor Vance",
        phone: "9876543210",
        house: "Apartment 4B",
        street: "Rue de Fleur",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
        isDefault: true,
      },
    ],
  });

  const authA = getAuthHeader(userA);

  // 1. Fetch addresses via API
  const resA = await fetch(`${API_BASE}/profile/addresses`, {
    method: "GET",
    headers: authA,
  });
  const dataA = await resA.json();
  assert(resA.ok && dataA.success, "GET /api/profile/addresses returns 200 OK");
  assert(dataA.addresses.length === 1, "User has exactly 1 saved address");
  const savedAddressA = dataA.addresses[0];

  // 2. Add product to cart
  await Cart.deleteMany({ user: userA._id });
  await fetch(`${API_BASE}/cart/items`, {
    method: "POST",
    headers: authA,
    body: JSON.stringify({
      productId: product._id.toString(),
      variantId: testVariant._id.toString(),
      quantity: 1,
    }),
  });

  // 3. Place order using saved address ID
  const orderResA = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: authA,
    body: JSON.stringify({
      addressId: savedAddressA._id,
      paymentMethod: "COD",
    }),
  });
  const orderDataA = await orderResA.json();
  assert(orderResA.ok && orderDataA.success, "Order placed successfully using saved address ID");
  assert(orderDataA.order.shippingAddress.addressId.toString() === savedAddressA._id.toString(), "Order references correct address ID");
  assert(orderDataA.order.shippingAddress.fullName === "Eleanor Vance", "Order snapshot has correct recipient name");
  assert(orderDataA.order.shippingAddress.house === "Apartment 4B", "Order snapshot has correct house/building");

  // ==============================================================
  // TEST B: USER WITH MULTIPLE SAVED ADDRESSES
  // ==============================================================
  console.log("\n>>> RUNNING TEST B: User with multiple saved addresses...");
  await User.deleteOne({ email: "checkout_test_user_b@fexa.com" });
  const userB = await User.create({
    name: "Aman Aziz",
    email: "checkout_test_user_b@fexa.com",
    password: "hashedpassword123",
    phone: "9123456780",
    addresses: [
      {
        label: "Home",
        fullName: "Aman Aziz (Home)",
        phone: "9123456780",
        house: "Penthouse 12",
        street: "Marine Drive",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400020",
        country: "India",
        isDefault: true,
      },
      {
        label: "Work",
        fullName: "Aman Aziz (Atelier Office)",
        phone: "9123456780",
        house: "Studio 8",
        street: "Boutique Arcade",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400051",
        country: "India",
        isDefault: false,
      },
    ],
  });

  const authB = getAuthHeader(userB);

  const resB = await fetch(`${API_BASE}/profile/addresses`, {
    method: "GET",
    headers: authB,
  });
  const dataB = await resB.json();
  assert(resB.ok && dataB.addresses.length === 2, "User B has 2 saved addresses");

  // Select the non-default "Work" address
  const workAddress = dataB.addresses.find((a) => a.label === "Work");
  assert(workAddress !== undefined, "Found Work address among saved addresses");

  await Cart.deleteMany({ user: userB._id });
  await fetch(`${API_BASE}/cart/items`, {
    method: "POST",
    headers: authB,
    body: JSON.stringify({
      productId: product._id.toString(),
      variantId: testVariant._id.toString(),
      quantity: 1,
    }),
  });

  const orderResB = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: authB,
    body: JSON.stringify({
      addressId: workAddress._id,
      paymentMethod: "COD",
    }),
  });
  const orderDataB = await orderResB.json();
  assert(orderResB.ok && orderDataB.success, "Order placed successfully with user-selected Work address");
  assert(orderDataB.order.shippingAddress.label === "Work", "Order shippingAddress snapshot has label 'Work'");
  assert(orderDataB.order.shippingAddress.fullName === "Aman Aziz (Atelier Office)", "Order snapshot matches selected Work address recipient");
  assert(orderDataB.order.shippingAddress.house === "Studio 8", "Order snapshot matches selected Work address house");

  // ==============================================================
  // TEST C: DEFAULT ADDRESS SELECTION
  // ==============================================================
  console.log("\n>>> RUNNING TEST C: Default address identification...");
  const defaultAddressB = dataB.addresses.find((a) => a.isDefault === true);
  assert(defaultAddressB !== undefined && defaultAddressB.label === "Home", "User B's default address correctly marked as Home");

  // ==============================================================
  // TEST D: USER WITHOUT SAVED ADDRESSES
  // ==============================================================
  console.log("\n>>> RUNNING TEST D: User without saved addresses...");
  await User.deleteOne({ email: "checkout_test_user_d@fexa.com" });
  const userD = await User.create({
    name: "New Patron",
    email: "checkout_test_user_d@fexa.com",
    password: "hashedpassword123",
    phone: "9000000000",
    addresses: [],
  });
  const authD = getAuthHeader(userD);

  const resD = await fetch(`${API_BASE}/profile/addresses`, {
    method: "GET",
    headers: authD,
  });
  const dataD = await resD.json();
  assert(resD.ok && dataD.addresses.length === 0, "New user D has 0 saved addresses");

  // Attempting to place order without addressId should be rejected by backend
  await Cart.deleteMany({ user: userD._id });
  await fetch(`${API_BASE}/cart/items`, {
    method: "POST",
    headers: authD,
    body: JSON.stringify({
      productId: product._id.toString(),
      variantId: testVariant._id.toString(),
      quantity: 1,
    }),
  });

  const orderResD1 = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: authD,
    body: JSON.stringify({
      paymentMethod: "COD",
    }),
  });
  assert(orderResD1.status === 400, "Order rejected with 400 when user has no selected address");

  // User adds address via Profile API
  const addAddrResD = await fetch(`${API_BASE}/profile/addresses`, {
    method: "POST",
    headers: authD,
    body: JSON.stringify({
      label: "Home",
      fullName: "New Patron",
      phone: "9000000000",
      house: "Suite 1A",
      street: "Palm Avenue",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      country: "India",
      isDefault: true,
    }),
  });
  const addAddrDataD = await addAddrResD.json();
  assert(addAddrResD.status === 201 && addAddrDataD.addresses.length === 1, "Added address in Profile successfully");

  // Now fetching addresses returns the newly added address
  const resD2 = await fetch(`${API_BASE}/profile/addresses`, {
    method: "GET",
    headers: authD,
  });
  const dataD2 = await resD2.json();
  assert(dataD2.addresses.length === 1, "User D now has 1 saved address available for checkout");

  // ==============================================================
  // TEST E: ADDRESS OWNERSHIP SECURITY
  // ==============================================================
  console.log("\n>>> RUNNING TEST E: Address ownership security...");
  // User D attempts to place an order using User B's address ID
  const maliciousOrderRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: authD,
    body: JSON.stringify({
      addressId: workAddress._id, // Belongs to User B!
      paymentMethod: "COD",
    }),
  });
  const maliciousData = await maliciousOrderRes.json();
  assert(maliciousOrderRes.status === 400, "Backend rejected order with 400 when submitting another user's address ID");
  assert(maliciousData.success === false, "Malicious request failed security verification");

  // Arbitrary address object without saved ID must also be rejected
  const arbitraryOrderRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: authD,
    body: JSON.stringify({
      shippingAddress: {
        fullName: "Fake Hacker",
        phone: "9999999999",
        addressLine: "Fake St",
        city: "Fake City",
        pincode: "111111",
      },
      paymentMethod: "COD",
    }),
  });
  assert(arbitraryOrderRes.status === 400, "Arbitrary non-saved address payload rejected with 400");

  // ==============================================================
  // TEST F: ADDRESS EDITED AFTER ORDER (IMMUTABLE SNAPSHOT)
  // ==============================================================
  console.log("\n>>> RUNNING TEST F: Address edited after order...");
  // Place an order for User D with their current address ("Suite 1A", "Palm Avenue")
  const newAddrD = dataD2.addresses[0];
  const orderResF = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: authD,
    body: JSON.stringify({
      addressId: newAddrD._id,
      paymentMethod: "COD",
    }),
  });
  const orderDataF = await orderResF.json();
  assert(orderResF.ok && orderDataF.success, "Order placed for User D");
  const placedOrderId = orderDataF.order._id;
  assert(orderDataF.order.shippingAddress.house === "Suite 1A", "Order created with house 'Suite 1A'");

  // User D edits their address in Profile to "Villa Royal 999", "New Boulevard"
  await fetch(`${API_BASE}/profile/addresses/${newAddrD._id}`, {
    method: "PUT",
    headers: authD,
    body: JSON.stringify({
      label: "Home",
      fullName: "New Patron (Renamed)",
      phone: "9000000000",
      house: "Villa Royal 999",
      street: "New Boulevard",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      country: "India",
      isDefault: true,
    }),
  });

  // Verify historical order still retains original snapshot
  const historicalOrder = await Order.findById(placedOrderId);
  assert(historicalOrder.shippingAddress.house === "Suite 1A", "Historical order retains original house 'Suite 1A'");
  assert(historicalOrder.shippingAddress.street === "Palm Avenue", "Historical order retains original street 'Palm Avenue'");
  assert(historicalOrder.shippingAddress.fullName === "New Patron", "Historical order retains original recipient name");

  // ==============================================================
  // TEST G: CHECKOUT REGRESSION (VARIANTS, STOCK, CART)
  // ==============================================================
  console.log("\n>>> RUNNING TEST G: Checkout regression testing...");
  const prodBeforeG = await Product.findById(product._id);
  const variantBeforeG = prodBeforeG.variants.find((v) => v._id.toString() === testVariant._id.toString());
  const initialStockG = variantBeforeG.stock;

  // Add 2 items of specific size variant
  await fetch(`${API_BASE}/cart/items`, {
    method: "POST",
    headers: authA,
    body: JSON.stringify({
      productId: product._id.toString(),
      variantId: testVariant._id.toString(),
      quantity: 2,
    }),
  });

  const regressionOrderRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: authA,
    body: JSON.stringify({
      addressId: savedAddressA._id,
      paymentMethod: "COD",
    }),
  });
  const regOrderData = await regressionOrderRes.json();
  assert(regressionOrderRes.ok && regOrderData.success, "Regression order placed successfully");
  assert(regOrderData.order.items[0].volumeMl === testVariant.volumeMl, `Item has correct variant volume ${testVariant.volumeMl} ml`);
  assert(regOrderData.order.items[0].quantity === 2, "Item has correct quantity 2");

  // Verify atomic stock deduction
  const prodAfter = await Product.findById(product._id);
  const variantAfter = prodAfter.variants.find((v) => v._id.toString() === testVariant._id.toString());
  assert(variantAfter.stock === initialStockG - 2, `Variant stock deducted from ${initialStockG} to ${variantAfter.stock}`);

  // Verify user cart is cleared
  const cartAfter = await Cart.findOne({ user: userA._id });
  assert(!cartAfter || cartAfter.items.length === 0, "Cart was properly emptied after order placement");

  // Cleanup test users and restore inventory
  await Product.updateOne(
    { _id: product._id, "variants._id": testVariant._id },
    { $inc: { "variants.$.stock": 4, stock: 4 } }
  );
  await Order.deleteMany({ user: { $in: [userA._id, userB._id, userD._id] } });
  await User.deleteMany({ _id: { $in: [userA._id, userB._id, userD._id] } });

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passedCount}/${totalCount} TESTS PASSED`);
  console.log("==================================================\n");

  await mongoose.disconnect();
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
