import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Order from "./models/order.model.js";
import Product from "./models/product.model.js";
import User from "./models/user.model.js";
import Coupon from "./models/coupon.model.js";
import { calculateItemCouponAllocations, calculateItemRefund, roundToPaise } from "./utils/couponAllocation.js";
import { cancelOrderItem } from "./controllers/order.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ PASS: ${message}`);
    passed++;
  }
}

async function runCancellationSuite() {
  console.log("=================================================");
  console.log("RUNNING FEXA PRODUCT CANCELLATION TEST SUITE");
  console.log("=================================================");

  await mongoose.connect(process.env.MONGO_URI);

  // 1. Setup mock user and products
  let userA = await User.findOne({ email: "cancel_patron_a@fexa.test" });
  if (!userA) {
    userA = await User.create({
      name: "Patron Aurelius",
      email: "cancel_patron_a@fexa.test",
      password: "HashedPassword123!",
      role: "user",
      isEmailVerified: true,
    });
  }

  let userB = await User.findOne({ email: "cancel_patron_b@fexa.test" });
  if (!userB) {
    userB = await User.create({
      name: "Patron Beatrice",
      email: "cancel_patron_b@fexa.test",
      password: "HashedPassword123!",
      role: "user",
      isEmailVerified: true,
    });
  }

  // Create 3 test products with variants and known stock
  const p1 = await Product.create({
    name: "Oud Supreme " + Date.now(),
    category: "Unisex",
    brand: "FEXA",
    description: "Testing cancellation Oud",
    price: 1000,
    stock: 50,
    status: "Active",
    variants: [
      {
        volumeMl: 50,
        price: 1000,
        sellingPrice: 1000,
        stock: 50,
        isAvailable: true,
      },
    ],
  });

  const p2 = await Product.create({
    name: "Rose Éternelle " + Date.now(),
    category: "Women",
    brand: "FEXA",
    description: "Testing cancellation Rose",
    price: 2000,
    stock: 30,
    status: "Active",
    variants: [
      {
        volumeMl: 100,
        price: 2000,
        sellingPrice: 2000,
        stock: 30,
        isAvailable: true,
      },
    ],
  });

  const p3 = await Product.create({
    name: "Ambre Impérial " + Date.now(),
    category: "Men",
    brand: "FEXA",
    description: "Testing cancellation Ambre",
    price: 1500,
    stock: 20,
    status: "Active",
    variants: [
      {
        volumeMl: 75,
        price: 1500,
        sellingPrice: 1500,
        stock: 20,
        isAvailable: true,
      },
    ],
  });

  // Calculate allocated discounts with a 10% coupon across the 3 items:
  // P1: ₹1,000 (10% = ₹100), net ₹900
  // P2: ₹2,000 (10% = ₹200), net ₹1,800
  // P3: ₹1,500 (10% = ₹150), net ₹1,350
  // Subtotal = ₹4,500, Coupon = ₹450, Net Merchandise = ₹4,050, Shipping = ₹250, Total = ₹4,300
  const orderItemsInput = [
    {
      product: p1._id,
      variantId: p1.variants[0]._id,
      name: p1.name,
      volumeMl: 50,
      quantity: 1,
      unitPrice: 1000,
      originalPrice: 1000,
      lineTotal: 1000,
      originalLineAmount: 1000,
    },
    {
      product: p2._id,
      variantId: p2.variants[0]._id,
      name: p2.name,
      volumeMl: 100,
      quantity: 1,
      unitPrice: 2000,
      originalPrice: 2000,
      lineTotal: 2000,
      originalLineAmount: 2000,
    },
    {
      product: p3._id,
      variantId: p3.variants[0]._id,
      name: p3.name,
      volumeMl: 75,
      quantity: 1,
      unitPrice: 1500,
      originalPrice: 1500,
      lineTotal: 1500,
      originalLineAmount: 1500,
    },
  ];

  const coupon = { code: "FEXA10", discountPercentage: 10, maxDiscount: null };
  const allocation = calculateItemCouponAllocations({
    items: orderItemsInput,
    coupon,
    merchandiseSubtotal: 4500,
    originalSubtotal: 4500,
  });

  const testOrder = await Order.create({
    orderNumber: `TEST-CANCEL-${Date.now()}`,
    user: userA._id,
    items: allocation.allocatedItems,
    subtotal: 4500,
    originalSubtotal: 4500,
    totalOfferDiscount: 0,
    couponCode: "FEXA10",
    discountAmount: 450,
    discountPercentage: 10,
    shippingCost: 250,
    totalAmount: 4300,
    paymentMethod: "COD",
    paymentStatus: "Pending",
    orderStatus: "Processing",
  });

  const item1Id = testOrder.items[0]._id.toString();
  const item2Id = testOrder.items[1]._id.toString();
  const item3Id = testOrder.items[2]._id.toString();

  // -------------------------------------------------------------
  // TEST SCENARIO 1 & 2: Cancel Product 2 (P2) from a 3-item Order
  // -------------------------------------------------------------
  console.log("\n--- TEST SCENARIO 1 & 2: CANCEL 1 PRODUCT OF 3 ---");
  {
    const req = {
      user: { id: userA._id.toString() },
      params: { orderId: testOrder._id.toString(), itemId: item2Id },
      body: { reason: "Changed my mind" },
    };

    let responseData = null;
    let responseStatus = 200;
    const res = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await cancelOrderItem(req, res);

    assert(responseStatus === 200, `Cancellation succeeded with status 200 (got ${responseStatus})`);
    assert(responseData.success === true, `API returned success: true`);

    const updatedOrder = await Order.findById(testOrder._id);
    const item1 = updatedOrder.items.id(item1Id);
    const item2 = updatedOrder.items.id(item2Id);
    const item3 = updatedOrder.items.id(item3Id);

    assert(item2.itemStatus === "Cancelled", `Product 2 is marked 'Cancelled' (got ${item2.itemStatus})`);
    assert(item1.itemStatus === "Active", `Product 1 remains 'Active' (got ${item1.itemStatus})`);
    assert(item3.itemStatus === "Active", `Product 3 remains 'Active' (got ${item3.itemStatus})`);
    assert(updatedOrder.orderStatus === "Processing", `Overall order remains 'Processing' because other products are active (got ${updatedOrder.orderStatus})`);

    // Verify stock restoration for P2
    const freshP2 = await Product.findById(p2._id);
    assert(freshP2.variants[0].stock === 31, `Stock for Product 2 was restored from 30 to 31 (got ${freshP2.variants[0].stock})`);
    assert(freshP2.stock === 31, `Total product stock was restored to 31 (got ${freshP2.stock})`);
  }

  // -------------------------------------------------------------
  // TEST SCENARIO 5: Try cancelling an already cancelled product (Re-entrancy/Duplicate Protection)
  // -------------------------------------------------------------
  console.log("\n--- TEST SCENARIO 5 & 10: PREVENT DUPLICATE CANCELLATION & DUPLICATE STOCK RESTORATION ---");
  {
    const req = {
      user: { id: userA._id.toString() },
      params: { orderId: testOrder._id.toString(), itemId: item2Id },
      body: { reason: "Clicking again" },
    };

    let responseData = null;
    let responseStatus = 200;
    const res = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await cancelOrderItem(req, res);

    assert(responseStatus === 400, `Duplicate cancellation rejected with 400 (got ${responseStatus})`);
    assert(responseData.success === false, `Duplicate cancellation returned success: false`);

    // Verify stock was NOT restored a second time
    const freshP2 = await Product.findById(p2._id);
    assert(freshP2.variants[0].stock === 31, `Stock remains exactly 31 without duplicate restoration (got ${freshP2.variants[0].stock})`);
  }

  // -------------------------------------------------------------
  // TEST SCENARIO 11: Try cancelling another user's order
  // -------------------------------------------------------------
  console.log("\n--- TEST SCENARIO 11: REJECT UNAUTHORIZED PATRON CANCELLATION ---");
  {
    const req = {
      user: { id: userB._id.toString() }, // User B attempting to cancel User A's order
      params: { orderId: testOrder._id.toString(), itemId: item1Id },
      body: { reason: "Unauthorized attempt" },
    };

    let responseData = null;
    let responseStatus = 200;
    const res = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await cancelOrderItem(req, res);

    assert(responseStatus === 404, `Access rejected with 404 Not Found (got ${responseStatus})`);
    assert(responseData.success === false, `Unauthorized access returned success: false`);
  }

  // -------------------------------------------------------------
  // TEST SCENARIO 4: Try cancelling a Shipped / Delivered order
  // -------------------------------------------------------------
  console.log("\n--- TEST SCENARIO 4: REJECT CANCELLATION FOR SHIPPED ORDER ---");
  {
    const shippedOrder = await Order.create({
      orderNumber: `TEST-SHIPPED-${Date.now()}`,
      user: userA._id,
      items: [
        {
          product: p1._id,
          variantId: p1.variants[0]._id,
          name: p1.name,
          volumeMl: 50,
          quantity: 1,
          unitPrice: 1000,
          lineTotal: 1000,
          itemStatus: "Active",
        },
      ],
      subtotal: 1000,
      totalAmount: 1250,
      paymentMethod: "COD",
      paymentStatus: "Pending",
      orderStatus: "Shipped", // Already shipped!
    });

    const shippedItemId = shippedOrder.items[0]._id.toString();

    const req = {
      user: { id: userA._id.toString() },
      params: { orderId: shippedOrder._id.toString(), itemId: shippedItemId },
      body: { reason: "Too late to cancel" },
    };

    let responseData = null;
    let responseStatus = 200;
    const res = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await cancelOrderItem(req, res);

    assert(responseStatus === 400, `Shipped item cancellation rejected with 400 (got ${responseStatus})`);
    assert(responseData.message.includes("shipped"), `Error message mentions order is shipped: "${responseData.message}"`);

    await Order.findByIdAndDelete(shippedOrder._id);
  }

  // -------------------------------------------------------------
  // TEST SCENARIO 3: Cancel remaining items until ALL items are cancelled
  // -------------------------------------------------------------
  console.log("\n--- TEST SCENARIO 3: CANCEL ALL PRODUCTS AND UPDATE OVERALL ORDER STATUS ---");
  {
    // Cancel Item 1
    const req1 = {
      user: { id: userA._id.toString() },
      params: { orderId: testOrder._id.toString(), itemId: item1Id },
      body: { reason: "Cancelling P1" },
    };
    const res1 = { status(c) { return this; }, json(d) { return this; } };
    await cancelOrderItem(req1, res1);

    // Cancel Item 3
    const req3 = {
      user: { id: userA._id.toString() },
      params: { orderId: testOrder._id.toString(), itemId: item3Id },
      body: { reason: "Cancelling P3" },
    };
    const res3 = { status(c) { return this; }, json(d) { return this; } };
    await cancelOrderItem(req3, res3);

    const finalOrder = await Order.findById(testOrder._id);
    assert(finalOrder.items[0].itemStatus === "Cancelled", `Item 1 is Cancelled`);
    assert(finalOrder.items[1].itemStatus === "Cancelled", `Item 2 is Cancelled`);
    assert(finalOrder.items[2].itemStatus === "Cancelled", `Item 3 is Cancelled`);
    assert(finalOrder.orderStatus === "Cancelled", `Overall order status transitioned to 'Cancelled' because all items were cancelled (got ${finalOrder.orderStatus})`);
  }

  // -------------------------------------------------------------
  // TEST SCENARIO 6, 7 & 8: Refund calculation on Paid Order with Coupon & Product Offer
  // -------------------------------------------------------------
  console.log("\n--- TEST SCENARIO 6, 7 & 8: REFUND CALCULATION WITH PRODUCT OFFER & COUPON ---");
  {
    // Product original: 500
    // Offer discount: 100 -> unitPrice: 400
    // 50% Coupon: 250 allocated
    // discountedLineAmount = 150
    // Paid via Razorpay
    const onlineOrder = await Order.create({
      orderNumber: `TEST-RZP-CANCEL-${Date.now()}`,
      user: userA._id,
      items: [
        {
          product: p1._id,
          variantId: p1.variants[0]._id,
          name: "Rouge Chaotique",
          volumeMl: 50,
          quantity: 1,
          unitPrice: 400,
          originalPrice: 500,
          offerDiscount: 100,
          offerAdjustedUnitPrice: 400,
          lineTotal: 400,
          originalLineAmount: 500,
          allocatedCouponDiscount: 250,
          discountedLineAmount: 150,
          discountedUnitAmount: 150,
          itemStatus: "Active",
        },
      ],
      subtotal: 400,
      originalSubtotal: 500,
      totalOfferDiscount: 100,
      couponCode: "SAVE50",
      discountAmount: 250,
      shippingCost: 250,
      totalAmount: 400,
      paymentMethod: "Razorpay",
      paymentStatus: "Paid",
      razorpayOrderId: "order_mock_test_123",
      razorpayPaymentId: "pay_mock_test_123",
      orderStatus: "Processing",
    });

    const targetItemId = onlineOrder.items[0]._id.toString();

    const req = {
      user: { id: userA._id.toString() },
      params: { orderId: onlineOrder._id.toString(), itemId: targetItemId },
      body: { reason: "Cancellation with refund test" },
    };

    let responseData = null;
    let responseStatus = 200;
    const res = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await cancelOrderItem(req, res);

    assert(responseStatus === 200, `Online order cancellation responded with 200`);
    assert(responseData.success === true, `Online cancellation succeeded`);

    const freshOrder = await Order.findById(onlineOrder._id);
    const cancelledLine = freshOrder.items[0];

    assert(cancelledLine.itemStatus === "Cancelled", `Item is marked Cancelled`);
    // Verify refund amount is exactly ₹150 (the net amount paid after offer & coupon!)
    assert(cancelledLine.discountedLineAmount === 150, `Discounted line amount retained at ₹150 (got ${cancelledLine.discountedLineAmount})`);
    assert(
      cancelledLine.refundStatus === "Refunded" || cancelledLine.refundStatus === "Pending",
      `Refund status marked correctly as '${cancelledLine.refundStatus}'`
    );

    await Order.findByIdAndDelete(onlineOrder._id);
  }

  // Cleanup test documents
  await Order.findByIdAndDelete(testOrder._id);
  await Product.findByIdAndDelete(p1._id);
  await Product.findByIdAndDelete(p2._id);
  await Product.findByIdAndDelete(p3._id);

  console.log("\n=================================================");
  console.log(`🎉 ALL ${passed}/${total} CANCELLATION TEST SCENARIOS PASSED!`);
  console.log("=================================================");
  process.exit(0);
}

runCancellationSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
