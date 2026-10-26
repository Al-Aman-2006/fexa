/**
 * Comprehensive Test Suite for FEXA Razorpay Payment Gateway Integration
 * Tests:
 * 1. Fetching public Razorpay Key ID
 * 2. Creating a live Razorpay order via Razorpay API using provided credentials
 * 3. Rejecting forged/invalid payment signatures
 * 4. Verifying valid Razorpay payment signature, reserving flacons, and creating order
 * 5. Replay attack protection (idempotency check)
 * 6. Order history verification showing Razorpay Online payment status
 * 7. Recording payment failure without stock deduction or cart clearing
 * 8. Safe payment retry reusing internal order without duplicate database records
 * 9. Switching a failed online order to Cash on Delivery (COD) safely reusing order record
 * 10. Check order status endpoint for recovery after interrupted requests
 */

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
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
  console.log("FEXA RAZORPAY PAYMENT GATEWAY TEST SUITE");
  console.log("==================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.\n");

  // 1. Setup / retrieve test user with a saved address
  await User.deleteOne({ email: "razorpay_test_patron@fexa.com" });
  const testUser = await User.create({
    name: "Genevieve Roche",
    email: "razorpay_test_patron@fexa.com",
    password: "hashedpassword123",
    phone: "9876543210",
    addresses: [
      {
        label: "Home",
        fullName: "Genevieve Roche",
        phone: "9876543210",
        house: "Mansion 7",
        street: "Rue de la Paix",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
        isDefault: true,
      },
    ],
  });

  const authHeader = getAuthHeader(testUser);
  const userAddressId = testUser.addresses[0]._id.toString();

  // 2. Find an active perfume product with stock
  const product = await Product.findOne({
    status: "Active",
    "variants.stock": { $gte: 10 },
  });
  assert(product !== null, `Found active test product: "${product?.name}"`);

  const variant = product.variants.find((v) => v.stock >= 10);
  assert(variant !== null, `Selected perfume variant: ${variant?.volumeMl} ml (Stock: ${variant?.stock})`);
  const initialStock = variant.stock;

  // 3. Put 1 item in cart
  await Cart.deleteMany({ user: testUser._id });
  const cartRes = await fetch(`${API_BASE}/cart/items`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      productId: product._id.toString(),
      variantId: variant._id.toString(),
      quantity: 1,
    }),
  });
  const cartData = await cartRes.json();
  assert(cartRes.ok && cartData.success, "Item successfully added to shopping bag");

  // ==============================================================
  // TEST 1: GET PUBLIC RAZORPAY KEY ID
  // ==============================================================
  console.log("\n>>> TEST 1: Fetching public Razorpay Key ID...");
  const keyRes = await fetch(`${API_BASE}/orders/razorpay/key`, {
    method: "GET",
    headers: authHeader,
  });
  const keyData = await keyRes.json();
  assert(keyRes.ok && keyData.success, "GET /api/orders/razorpay/key returned 200 OK");
  assert(keyData.keyId === "rzp_test_TqUYTgZOU4T32M", `Returned Key ID matches expected: ${keyData.keyId}`);

  // ==============================================================
  // TEST 2: CREATE LIVE RAZORPAY ORDER
  // ==============================================================
  console.log("\n>>> TEST 2: Creating Razorpay order via Razorpay API...");
  const createRzpRes = await fetch(`${API_BASE}/orders/razorpay/create-order`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      addressId: userAddressId,
    }),
  });
  const createRzpData = await createRzpRes.json();
  assert(createRzpRes.ok && createRzpData.success, "POST /api/orders/razorpay/create-order returned 200 OK");
  assert(typeof createRzpData.razorpayOrderId === "string" && createRzpData.razorpayOrderId.startsWith("order_"), `Created live Razorpay order with ID: ${createRzpData.razorpayOrderId}`);
  assert(createRzpData.amount > 0, `Order amount in paisa: ${createRzpData.amount}`);
  assert(createRzpData.currency === "INR", `Currency is INR`);
  assert(createRzpData.keyId === "rzp_test_TqUYTgZOU4T32M", `Key ID verified: ${createRzpData.keyId}`);
  assert(typeof createRzpData.orderId === "string", `Internal MongoDB Order ID created: ${createRzpData.orderId}`);

  const liveRazorpayOrderId = createRzpData.razorpayOrderId;
  const mockPaymentId = `pay_${Date.now()}_test`;

  // ==============================================================
  // TEST 3: REJECT INVALID / TAMPERED SIGNATURE
  // ==============================================================
  console.log("\n>>> TEST 3: Rejecting invalid payment signature...");
  const forgedSignature = "forged_invalid_signature_hex_123456789";
  const invalidSigRes = await fetch(`${API_BASE}/orders/razorpay/verify-payment`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      orderId: createRzpData.orderId,
      addressId: userAddressId,
      razorpay_order_id: liveRazorpayOrderId,
      razorpay_payment_id: mockPaymentId,
      razorpay_signature: forgedSignature,
    }),
  });
  const invalidSigData = await invalidSigRes.json();
  assert(invalidSigRes.status === 400 && invalidSigData.success === false, "Server correctly rejected forged signature with 400 Bad Request");

  // ==============================================================
  // TEST 4: VERIFY GENUINE SIGNATURE & PLACE ORDER
  // ==============================================================
  console.log("\n>>> TEST 4: Verifying authentic HMAC-SHA256 signature and completing order...");
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${liveRazorpayOrderId}|${mockPaymentId}`);
  const authenticSignature = hmac.digest("hex");

  const verifyRes = await fetch(`${API_BASE}/orders/razorpay/verify-payment`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      orderId: createRzpData.orderId,
      addressId: userAddressId,
      paymentMethod: "Razorpay",
      razorpay_order_id: liveRazorpayOrderId,
      razorpay_payment_id: mockPaymentId,
      razorpay_signature: authenticSignature,
    }),
  });
  const verifyData = await verifyRes.json();
  assert(verifyRes.status === 201 && verifyData.success === true, "POST /api/orders/razorpay/verify-payment succeeded (201 Created)");
  assert(verifyData.order.paymentStatus === "Paid", "Order paymentStatus is 'Paid'");
  assert(verifyData.order.paymentMethod === "Razorpay", "Order paymentMethod is 'Razorpay'");
  assert(verifyData.order.razorpayOrderId === liveRazorpayOrderId, "Order stores correct razorpayOrderId");
  assert(verifyData.order.razorpayPaymentId === mockPaymentId, "Order stores correct razorpayPaymentId");
  assert(verifyData.order.orderStatus === "Processing", "Order status is 'Processing'");

  // Verify stock was deducted
  const prodAfter = await Product.findById(product._id);
  const variantAfter = prodAfter.variants.find((v) => v._id.toString() === variant._id.toString());
  assert(variantAfter.stock === initialStock - 1, `Variant stock decremented from ${initialStock} to ${variantAfter.stock}`);

  // Verify cart was cleared
  const cartAfter = await Cart.findOne({ user: testUser._id });
  assert(!cartAfter || cartAfter.items.length === 0, "Cart items cleared after order placement");

  // ==============================================================
  // TEST 5: IDEMPOTENCY / REPLAY PROTECTION
  // ==============================================================
  console.log("\n>>> TEST 5: Replay attack / Idempotency protection...");
  const replayRes = await fetch(`${API_BASE}/orders/razorpay/verify-payment`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      orderId: createRzpData.orderId,
      addressId: userAddressId,
      paymentMethod: "Razorpay",
      razorpay_order_id: liveRazorpayOrderId,
      razorpay_payment_id: mockPaymentId,
      razorpay_signature: authenticSignature,
    }),
  });
  const replayData = await replayRes.json();
  assert(replayRes.ok && replayData.success, "Replay handled idempotently without error");
  assert(replayData.order._id === verifyData.order._id, "Returned existing order ID without creating duplicate or double-charging stock");

  // Verify stock was NOT deducted again
  const prodReplay = await Product.findById(product._id);
  const variantReplay = prodReplay.variants.find((v) => v._id.toString() === variant._id.toString());
  assert(variantReplay.stock === initialStock - 1, `Variant stock remained exactly ${variantReplay.stock} without duplicate decrement`);

  // ==============================================================
  // TEST 6: ORDER HISTORY RETRIEVAL
  // ==============================================================
  console.log("\n>>> TEST 6: Order history retrieval...");
  const ordersRes = await fetch(`${API_BASE}/orders`, {
    method: "GET",
    headers: authHeader,
  });
  const ordersData = await ordersRes.json();
  assert(ordersRes.ok && ordersData.success, "GET /api/orders returned 200 OK");
  const placedOrder = ordersData.orders.find((o) => o._id === verifyData.order._id);
  assert(placedOrder !== undefined, "Placed order found in user's order history");
  assert(placedOrder.paymentMethod === "Razorpay", "Retrieved order has paymentMethod: 'Razorpay'");
  assert(placedOrder.paymentStatus === "Paid", "Retrieved order has paymentStatus: 'Paid'");
  assert(placedOrder.razorpayPaymentId === mockPaymentId, "Retrieved order displays razorpayPaymentId");

  // ==============================================================
  // TEST 7: RECORD PAYMENT FAILURE (WITHOUT STOCK DEDUCTION / CART CLEAR)
  // ==============================================================
  console.log("\n>>> TEST 7: Payment failure recording & cart preservation...");
  // Put an item back in cart
  await fetch(`${API_BASE}/cart/items`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      productId: product._id.toString(),
      variantId: variant._id.toString(),
      quantity: 1,
    }),
  });

  // Initiate a new checkout
  const initFailRes = await fetch(`${API_BASE}/orders/razorpay/create-order`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({ addressId: userAddressId }),
  });
  const initFailData = await initFailRes.json();
  assert(initFailRes.ok && initFailData.success, "Created internal order for failure test");
  const failedInternalOrderId = initFailData.orderId;

  const currentStockBeforeFail = (await Product.findById(product._id)).variants.find((v) => v._id.toString() === variant._id.toString()).stock;

  // Report payment failure
  const reportFailRes = await fetch(`${API_BASE}/orders/razorpay/payment-failed`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      orderId: failedInternalOrderId,
      razorpayOrderId: initFailData.razorpayOrderId,
      razorpayPaymentId: "pay_failed_sample_123",
      code: "BAD_REQUEST_ERROR",
      description: "Payment failed due to insufficient funds in customer bank account.",
    }),
  });
  const reportFailData = await reportFailRes.json();
  assert(reportFailRes.ok && reportFailData.success, "POST /api/orders/razorpay/payment-failed returned 200 OK");

  // Check DB state for failed order
  const failedOrderInDb = await Order.findById(failedInternalOrderId);
  assert(failedOrderInDb.paymentStatus === "Failed", "Order paymentStatus updated to 'Failed'");
  assert(failedOrderInDb.paymentErrorCode === "BAD_REQUEST_ERROR", "Order stored paymentErrorCode");
  assert(failedOrderInDb.paymentFailureReason.includes("insufficient funds"), "Order stored failure reason");

  // Verify stock was NOT deducted on failure
  const currentStockAfterFail = (await Product.findById(product._id)).variants.find((v) => v._id.toString() === variant._id.toString()).stock;
  assert(currentStockAfterFail === currentStockBeforeFail, `Stock intact after payment failure (${currentStockAfterFail} === ${currentStockBeforeFail})`);

  // Verify cart is NOT cleared on failure
  const cartAfterFail = await Cart.findOne({ user: testUser._id });
  assert(cartAfterFail && cartAfterFail.items.length > 0, "Cart items preserved after payment failure");

  // ==============================================================
  // TEST 8: SAFE RETRY REUSING INTERNAL ORDER (NO DUPLICATES)
  // ==============================================================
  console.log("\n>>> TEST 8: Safe retry reusing internal order...");
  const retryRzpRes = await fetch(`${API_BASE}/orders/razorpay/create-order`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      addressId: userAddressId,
      orderId: failedInternalOrderId, // Pass existing order ID to reuse
    }),
  });
  const retryRzpData = await retryRzpRes.json();
  assert(retryRzpRes.ok && retryRzpData.success, "POST /api/orders/razorpay/create-order with orderId succeeded");
  assert(retryRzpData.orderId === failedInternalOrderId, `Internal order ID preserved without duplicate creation (${retryRzpData.orderId} === ${failedInternalOrderId})`);

  // ==============================================================
  // TEST 9: SWITCH FAILED ORDER TO CASH ON DELIVERY (COD)
  // ==============================================================
  console.log("\n>>> TEST 9: Switching order to Cash on Delivery (COD)...");
  const switchCodRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      addressId: userAddressId,
      paymentMethod: "COD",
      orderId: failedInternalOrderId, // Safely converts the existing order
    }),
  });
  const switchCodData = await switchCodRes.json();
  assert(switchCodRes.ok && switchCodData.success, "Converted failed order to COD");
  assert(switchCodData.order._id === failedInternalOrderId, `Converted existing order ID: ${failedInternalOrderId}`);
  assert(switchCodData.order.paymentMethod === "COD", "Order converted to COD paymentMethod");
  assert(switchCodData.order.paymentStatus === "Pending", "COD order paymentStatus is 'Pending'");

  // Verify stock now deducted on confirmed COD
  const stockAfterCod = (await Product.findById(product._id)).variants.find((v) => v._id.toString() === variant._id.toString()).stock;
  assert(stockAfterCod === currentStockBeforeFail - 1, `Stock successfully deducted upon COD confirmation`);

  // ==============================================================
  // TEST 10: CHECK ORDER STATUS (RECOVERY ENDPOINT)
  // ==============================================================
  console.log("\n>>> TEST 10: Check order status endpoint...");
  const statusCheckRes = await fetch(`${API_BASE}/orders/razorpay/check-status/${failedInternalOrderId}`, {
    headers: authHeader,
  });
  const statusCheckData = await statusCheckRes.json();
  assert(statusCheckRes.ok && statusCheckData.success, "GET /api/orders/razorpay/check-status/:orderId returned 200 OK");
  assert(statusCheckData.order._id === failedInternalOrderId, "Status check returned the correct order");

  // Clean up test data
  await Order.deleteMany({ user: testUser._id });
  await Cart.deleteMany({ user: testUser._id });
  await User.deleteOne({ _id: testUser._id });
  // Restore variant stock
  await Product.updateOne(
    { _id: product._id, "variants._id": variant._id },
    { $set: { "variants.$.stock": initialStock, stock: product.stock } }
  );

  console.log("\n==================================================");
  console.log(`ALL TESTS PASSED: ${passedCount} / ${totalCount} ASSERTIONS`);
  console.log("==================================================");
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
