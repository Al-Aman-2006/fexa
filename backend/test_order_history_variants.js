/**
 * Automated Test Suite: Order History & Variant Integrity for FEXA
 * Verifies end-to-end checkout, order placement with volume variants,
 * stock deduction, and user order history endpoint.
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

async function runTestSuite() {
  console.log("==================================================");
  console.log("FEXA ORDER HISTORY & PERFUME VARIANT TEST SUITE");
  console.log("==================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.\n");

  // 1. Setup / retrieve test user
  let testUser = await User.findOne({ email: "patron_orders_test@fexa.com" });
  if (!testUser) {
    testUser = await User.create({
      name: "Jean-Claude Ellena",
      email: "patron_orders_test@fexa.com",
      password: "hashedpassword123",
      phone: "+91 98765 43210",
      addresses: [
        {
          label: "Home",
          fullName: "Jean-Claude Ellena",
          phone: "9876543210",
          house: "Villa de Grasse 42",
          street: "Boulevard des Parfums",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
          country: "India",
          isDefault: true,
        },
      ],
    });
  }

  const token = jwt.sign(
    { id: testUser._id.toString(), role: "user" },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Cookie: `token=${token}`,
  };

  // 2. Select an active product with variants
  const product = await Product.findOne({
    status: "Active",
    "variants.stock": { $gte: 5 },
  });
  assert(product !== null, "Found active product with variants and stock in MongoDB");

  const selectedVariant = product.variants.find((v) => v.stock >= 5);
  assert(selectedVariant !== null, `Selected variant ${selectedVariant.volumeMl} ml`);
  const initialStock = selectedVariant.stock;

  // 3. Clear user's previous orders & cart for a clean test
  await Order.deleteMany({ user: testUser._id });
  await Cart.deleteMany({ user: testUser._id });

  // 4. Test GET /api/orders returns empty array initially
  const emptyRes = await fetch(`${API_BASE}/orders`, {
    method: "GET",
    headers: authHeaders,
  });
  const emptyData = await emptyRes.json();
  assert(emptyRes.ok && emptyData.success === true, "GET /api/orders returns 200 OK");
  assert(Array.isArray(emptyData.orders) && emptyData.orders.length === 0, "Initial orders list is empty");

  // 5. Add product with selected size variant to cart
  const orderQuantity = 2;
  const addCartRes = await fetch(`${API_BASE}/cart/items`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      productId: product._id.toString(),
      variantId: selectedVariant._id.toString(),
      quantity: orderQuantity,
    }),
  });
  const addCartData = await addCartRes.json();
  assert(addCartRes.ok && addCartData.success === true, `Added ${orderQuantity}x ${selectedVariant.volumeMl}ml to cart`);

  // 6. Place Order via POST /api/orders
  const placeOrderRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      shippingAddress: testUser.addresses[0],
      paymentMethod: "COD",
    }),
  });
  const placeOrderData = await placeOrderRes.json();
  assert(placeOrderRes.ok && placeOrderData.success === true, "Order placed successfully via POST /api/orders");
  const createdOrder = placeOrderData.order;
  assert(createdOrder !== undefined && createdOrder.orderNumber.startsWith("FEXA-"), "Order number generated correctly");
  assert(createdOrder.items.length === 1, "Order contains exactly 1 item line");
  assert(createdOrder.items[0].volumeMl === selectedVariant.volumeMl, `Order line snapshot has volumeMl = ${selectedVariant.volumeMl} ml`);
  assert(createdOrder.items[0].unitPrice === selectedVariant.sellingPrice, `Order line unitPrice matches variant sellingPrice (${selectedVariant.sellingPrice})`);
  assert(createdOrder.items[0].lineTotal === selectedVariant.sellingPrice * orderQuantity, `Order line total matches unitPrice * qty (${selectedVariant.sellingPrice * orderQuantity})`);

  // 7. Verify stock deduction in database
  const updatedProduct = await Product.findById(product._id);
  const updatedVariant = updatedProduct.variants.find((v) => v._id.toString() === selectedVariant._id.toString());
  assert(updatedVariant.stock === initialStock - orderQuantity, `Variant stock atomically deducted from ${initialStock} to ${updatedVariant.stock}`);

  // 8. Fetch user orders via GET /api/orders
  const myOrdersRes = await fetch(`${API_BASE}/orders`, {
    method: "GET",
    headers: authHeaders,
  });
  const myOrdersData = await myOrdersRes.json();
  assert(myOrdersRes.ok && myOrdersData.success === true, "GET /api/orders responds with 200 OK");
  assert(myOrdersData.orders.length === 1, "Order history contains 1 placed order");
  const retrievedOrder = myOrdersData.orders[0];
  assert(retrievedOrder.orderNumber === createdOrder.orderNumber, "Retrieved order number matches placed order");
  assert(retrievedOrder.items[0].volumeMl === selectedVariant.volumeMl, `Retrieved order displays correct perfume size variant (${selectedVariant.volumeMl} ml)`);
  assert(retrievedOrder.orderStatus === "Processing", "Initial order status is 'Processing'");

  // 9. Fetch single order details via GET /api/orders/:id
  const singleOrderRes = await fetch(`${API_BASE}/orders/${createdOrder._id}`, {
    method: "GET",
    headers: authHeaders,
  });
  const singleOrderData = await singleOrderRes.json();
  assert(singleOrderRes.ok && singleOrderData.success === true, "GET /api/orders/:id retrieves single order");
  assert(singleOrderData.order._id === createdOrder._id, "Single order ID matches");

  // Restore inventory
  await Product.updateOne(
    { _id: product._id, "variants._id": selectedVariant._id },
    { $inc: { "variants.$.stock": orderQuantity, stock: orderQuantity } }
  );
  console.log(`\nReverted test inventory: restored +${orderQuantity} stock to variant ${selectedVariant.volumeMl} ml`);

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passedCount}/${totalCount} TESTS PASSED`);
  console.log("==================================================\n");

  await mongoose.disconnect();
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
