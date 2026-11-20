import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../../models/user.model.js";
import Wallet from "../../models/wallet.model.js";
import Order from "../../models/order.model.js";
import Product from "../../models/product.model.js";
import Category from "../../models/category.model.js";
import {
  getAdminOrderById,
  updateOrderStatus,
  ALLOWED_STATUS_TRANSITIONS,
  FULFILLMENT_STATUSES,
} from "../../controllers/adminOrder.controller.js";
import { streamOrderInvoicePDF } from "../../services/pdf.service.js";
import { PassThrough } from "stream";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI;

const runTests = async () => {
  console.log("===============================================================");
  console.log("   FEXA ADMIN ORDER MANAGEMENT VERIFICATION SUITE              ");
  console.log("===============================================================");

  if (!MONGO_URI) throw new Error("MONGO_URI not configured in .env");

  await mongoose.connect(MONGO_URI);
  console.log("✓ Connected to MongoDB Atlas\n");

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
    }
  };

  // 1. Setup Test Category & Product
  let cat = await Category.findOne({ slug: "admin-order-test-cat" });
  if (!cat) {
    cat = await Category.create({
      name: "Admin Order Category",
      slug: "admin-order-test-cat",
      description: "Category for Admin Order test",
      isActive: true,
    });
  }

  const testProduct = await Product.create({
    name: "Admin Order Perfume " + Date.now(),
    slug: "admin-order-perfume-" + Date.now(),
    description: "Test perfume for admin order management suite",
    category: cat.slug,
    price: 1500,
    images: ["/uploads/products/admin-test-perfume.webp"],
    variants: [
      {
        volumeMl: 100,
        sellingPrice: 1500,
        originalPrice: 1800,
        stock: 50,
        isAvailable: true,
      },
    ],
  });

  // Setup Test User
  let user = await User.findOne({ email: "admin_order_test@fexa.com" });
  if (!user) {
    user = await User.create({
      name: "Lord Ronald Test",
      email: "admin_order_test@fexa.com",
      password: "HashedPassword@123",
      phone: "9876543210",
      isEmailVerified: true,
      addresses: [
        {
          fullName: "Lord Ronald Test",
          phone: "9876543210",
          house: "Apt 4B, Royale Manor",
          street: "Crescent Boulevard",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          country: "India",
          isDefault: true,
        },
      ],
    });
  }

  // Setup User Wallet
  let wallet = await Wallet.findOne({ user: user._id });
  if (!wallet) {
    wallet = await Wallet.create({
      user: user._id,
      balance: 5000,
      transactions: [],
    });
  }

  // ==========================================================
  // SCENARIO 1: Create Wallet-paid Order & verify getAdminOrderById
  // ==========================================================
  console.log("Scenario 1: Fetching full details for Wallet-paid order via getAdminOrderById");
  const walletOrderNumber = `ORD-WLT-${Date.now()}`;
  const walletOrder = await Order.create({
    orderNumber: walletOrderNumber,
    user: user._id,
    customerEmail: user.email,
    shippingAddress: user.addresses[0],
    items: [
      {
        product: testProduct._id,
        variantId: testProduct.variants[0]._id,
        name: testProduct.name,
        brand: "FEXA",
        volumeMl: 100,
        quantity: 2,
        unitPrice: 1500,
        lineTotal: 3000,
        allocatedCouponDiscount: 300,
        discountedLineAmount: 2700,
        image: "/uploads/products/admin-test-perfume.webp",
      },
    ],
    subtotal: 3000,
    discountAmount: 300,
    shippingCost: 0,
    totalAmount: 2700,
    paymentMethod: "Wallet",
    paymentStatus: "Paid",
    orderStatus: "Processing",
    walletTransactionId: `TXN-WLT-${walletOrderNumber}`,
    inventoryProcessed: true,
    paidAt: new Date(),
  });

  // Mock req & res for getAdminOrderById
  const mockReq1 = { params: { orderId: walletOrder._id.toString() } };
  let resStatus1 = 0;
  let resData1 = null;
  const mockRes1 = {
    status: (code) => {
      resStatus1 = code;
      return {
        json: (data) => {
          resData1 = data;
        },
      };
    },
  };

  await getAdminOrderById(mockReq1, mockRes1);

  assert(resStatus1 === 200, `getAdminOrderById returned HTTP 200 (Got: ${resStatus1})`);
  assert(resData1?.success === true, "getAdminOrderById response has success: true");
  assert(resData1?.order?.orderNumber === walletOrderNumber, "Order number matches correctly");
  assert(resData1?.order?.customerName === "Lord Ronald Test", "Customer name properly extracted");
  assert(resData1?.order?.paymentMethod === "Wallet", "Payment method is Wallet");
  assert(resData1?.order?.walletTransactionId === `TXN-WLT-${walletOrderNumber}`, "Wallet transaction ID present");
  assert(resData1?.order?.items?.[0]?.image !== null, "Product image attached to item");
  assert(Array.isArray(resData1?.order?.allowedNextStatuses), "Allowed next statuses list present");
  assert(resData1?.order?.allowedNextStatuses.includes("Dispatched"), "Allowed next statuses includes Dispatched");

  // ==========================================================
  // SCENARIO 2: Valid Status Transition (Processing -> Dispatched)
  // ==========================================================
  console.log("\nScenario 2: Valid Status Transition (Processing -> Dispatched)");
  const mockReq2 = {
    params: { orderId: walletOrder._id.toString() },
    body: { status: "Dispatched", note: "Handed over to Blue Dart" },
    admin: { email: "admin@fexa.com", _id: new mongoose.Types.ObjectId() },
  };
  let resStatus2 = 0;
  let resData2 = null;
  const mockRes2 = {
    status: (code) => {
      resStatus2 = code;
      return {
        json: (data) => {
          resData2 = data;
        },
      };
    },
  };

  await updateOrderStatus(mockReq2, mockRes2);

  assert(resStatus2 === 200, `updateOrderStatus returned HTTP 200 (Got: ${resStatus2})`);
  assert(resData2?.success === true, "Status transition succeeded");
  const updatedWalletOrder = await Order.findById(walletOrder._id);
  assert(updatedWalletOrder.orderStatus === "Dispatched", "Order status in MongoDB is now Dispatched");
  assert(updatedWalletOrder.statusHistory.length > 0, "Status history audit trail appended");
  assert(updatedWalletOrder.statusHistory[0].newStatus === "Dispatched", "Audit trail records transition to Dispatched");

  // ==========================================================
  // SCENARIO 3: Illegal Status Transition (Dispatched -> Confirmed)
  // ==========================================================
  console.log("\nScenario 3: Illegal Status Transition (Dispatched -> Confirmed should be rejected)");
  const mockReq3 = {
    params: { orderId: walletOrder._id.toString() },
    body: { status: "Confirmed", note: "Illegal step backwards" },
    admin: { email: "admin@fexa.com" },
  };
  let resStatus3 = 0;
  let resData3 = null;
  const mockRes3 = {
    status: (code) => {
      resStatus3 = code;
      return {
        json: (data) => {
          resData3 = data;
        },
      };
    },
  };

  await updateOrderStatus(mockReq3, mockRes3);

  assert(resStatus3 === 400, `Illegal transition rejected with HTTP 400 (Got: ${resStatus3})`);
  assert(resData3?.success === false, "Response confirms illegal transition rejected");
  const unchangedOrder = await Order.findById(walletOrder._id);
  assert(unchangedOrder.orderStatus === "Dispatched", "Order status remains Dispatched");

  // ==========================================================
  // SCENARIO 4: Prevent Shipping/Delivery When Payment is Failed
  // ==========================================================
  console.log("\nScenario 4: Prevent Shipping/Delivery on Failed Payment Order");
  const failedOrder = await Order.create({
    orderNumber: `ORD-FAIL-${Date.now()}`,
    user: user._id,
    customerEmail: user.email,
    shippingAddress: user.addresses[0],
    items: [
      {
        product: testProduct._id,
        variantId: testProduct.variants[0]._id,
        name: testProduct.name,
        volumeMl: 100,
        quantity: 1,
        unitPrice: 1500,
        lineTotal: 1500,
      },
    ],
    subtotal: 1500,
    totalAmount: 1500,
    paymentMethod: "Razorpay",
    paymentStatus: "Failed",
    paymentFailureReason: "Card declined by issuing bank",
    orderStatus: "Processing",
    inventoryProcessed: false,
  });

  const mockReq4 = {
    params: { orderId: failedOrder._id.toString() },
    body: { status: "Dispatched", note: "Attempting to ship without payment" },
    admin: { email: "admin@fexa.com" },
  };
  let resStatus4 = 0;
  let resData4 = null;
  const mockRes4 = {
    status: (code) => {
      resStatus4 = code;
      return {
        json: (data) => {
          resData4 = data;
        },
      };
    },
  };

  await updateOrderStatus(mockReq4, mockRes4);

  assert(resStatus4 === 400, `Fulfillment on failed payment order blocked with HTTP 400 (Got: ${resStatus4})`);
  assert(resData4?.message?.includes("Payment has failed"), "Error message correctly explains payment has failed");
  const checkFailed = await Order.findById(failedOrder._id);
  assert(checkFailed.orderStatus === "Processing", "Order status in MongoDB remains Processing");

  // ==========================================================
  // SCENARIO 5: Admin Cancellation with Restock and Wallet Refund
  // ==========================================================
  console.log("\nScenario 5: Admin Cancellation with Restock and Idempotent Wallet Refund");
  // Setup order to cancel
  const cancelTestOrder = await Order.create({
    orderNumber: `ORD-CANCEL-${Date.now()}`,
    user: user._id,
    customerEmail: user.email,
    shippingAddress: user.addresses[0],
    items: [
      {
        product: testProduct._id,
        variantId: testProduct.variants[0]._id,
        name: testProduct.name,
        volumeMl: 100,
        quantity: 2,
        unitPrice: 1500,
        lineTotal: 3000,
        discountedLineAmount: 3000,
      },
    ],
    subtotal: 3000,
    totalAmount: 3000,
    paymentMethod: "Wallet",
    paymentStatus: "Paid",
    orderStatus: "Processing",
    inventoryProcessed: true,
  });

  const walletBeforeCancel = await Wallet.findOne({ user: user._id });
  const balBeforeCancel = walletBeforeCancel.balance;

  const mockReq5 = {
    params: { orderId: cancelTestOrder._id.toString() },
    body: { status: "Cancelled", note: "Customer requested cancellation via atelier support" },
    admin: { email: "admin@fexa.com" },
  };
  let resStatus5 = 0;
  let resData5 = null;
  const mockRes5 = {
    status: (code) => {
      resStatus5 = code;
      return {
        json: (data) => {
          resData5 = data;
        },
      };
    },
  };

  await updateOrderStatus(mockReq5, mockRes5);

  assert(resStatus5 === 200, `Cancellation returned HTTP 200 (Got: ${resStatus5})`);
  const cancelledOrderDoc = await Order.findById(cancelTestOrder._id);
  assert(cancelledOrderDoc.orderStatus === "Cancelled", "Order status is Cancelled in MongoDB");
  assert(cancelledOrderDoc.stockRestored === true, "Stock restored flag is true");
  assert(cancelledOrderDoc.totalRefundedAmount === 3000, "Refunded amount is recorded as 3000");

  const walletAfterCancel = await Wallet.findOne({ user: user._id });
  assert(
    walletAfterCancel.balance === balBeforeCancel + 3000,
    `Wallet balance increased by exactly 3000 (Before: ${balBeforeCancel}, After: ${walletAfterCancel.balance})`
  );

  // Duplicate cancellation call (idempotency check)
  console.log("\nScenario 6: Duplicate Cancellation Idempotency Check (No duplicate refund or restock)");
  await updateOrderStatus(mockReq5, mockRes5);
  const walletAfterDup = await Wallet.findOne({ user: user._id });
  assert(
    walletAfterDup.balance === walletAfterCancel.balance,
    `Wallet balance NOT double refunded (Still: ${walletAfterDup.balance})`
  );

  // ==========================================================
  // SCENARIO 7: PDF Invoice Stream Generation
  // ==========================================================
  console.log("\nScenario 7: PDF Invoice Stream Generation");
  try {
    const mockPdfRes = new PassThrough();
    mockPdfRes.setHeader = () => {};
    let chunks = [];
    mockPdfRes.on("data", (c) => chunks.push(c));
    const streamPromise = new Promise((resolve) => mockPdfRes.on("end", resolve));

    streamOrderInvoicePDF(walletOrder, user, mockPdfRes);
    await streamPromise;

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    assert(totalLength > 500, `PDF invoice generated and streamed successfully (${totalLength} bytes)`);
  } catch (pdfErr) {
    assert(false, `PDF generation failed: ${pdfErr.message}`);
  }

  // ==========================================================
  // SCENARIO 8: Delivered Order Lifecycle & Return Requested Removal
  // ==========================================================
  console.log("\nScenario 8: Delivered Order Lifecycle & Return Requested Removal");
  const deliveredOrder = await Order.create({
    orderNumber: `ORD-DELIV-${Date.now()}`,
    user: user._id,
    customerEmail: user.email,
    shippingAddress: user.addresses[0],
    items: [
      {
        product: testProduct._id,
        variantId: testProduct.variants[0]._id,
        name: testProduct.name,
        volumeMl: 100,
        quantity: 1,
        unitPrice: 1500,
        lineTotal: 1500,
        itemStatus: "Active",
      },
    ],
    subtotal: 1500,
    totalAmount: 1500,
    paymentMethod: "COD",
    paymentStatus: "Paid",
    orderStatus: "Delivered",
    inventoryProcessed: true,
  });

  const mockReq8 = { params: { orderId: deliveredOrder._id.toString() } };
  let resStatus8 = 0;
  let resData8 = null;
  const mockRes8 = {
    status: (code) => {
      resStatus8 = code;
      return {
        json: (data) => {
          resData8 = data;
        },
      };
    },
  };

  await getAdminOrderById(mockReq8, mockRes8);
  assert(resStatus8 === 200, "getAdminOrderById for Delivered order succeeded");
  assert(
    !resData8?.order?.allowedNextStatuses?.includes("Return Requested"),
    "Delivered order allowedNextStatuses does NOT contain 'Return Requested'"
  );
  assert(
    resData8?.order?.allowedNextStatuses?.length === 0,
    "Delivered order has no admin forward transitions (terminal delivery lifecycle)"
  );

  // ==========================================================
  // SCENARIO 9: Admin Attempt to Transition to Return Requested is Blocked
  // ==========================================================
  console.log("\nScenario 9: Admin Attempt to Transition to Return Requested is Blocked");
  const mockReq9 = {
    params: { orderId: deliveredOrder._id.toString() },
    body: { status: "Return Requested", note: "Admin trying to initiate return" },
    admin: { email: "admin@fexa.com" },
  };
  let resStatus9 = 0;
  let resData9 = null;
  const mockRes9 = {
    status: (code) => {
      resStatus9 = code;
      return {
        json: (data) => {
          resData9 = data;
        },
      };
    },
  };

  await updateOrderStatus(mockReq9, mockRes9);
  assert(resStatus9 === 400, `Admin transition to 'Return Requested' rejected with HTTP 400 (Got: ${resStatus9})`);
  assert(
    resData9?.message?.includes("Administrators cannot initiate return requests"),
    "Rejection message states returns must be initiated exclusively by patrons"
  );
  const checkDelivOrder = await Order.findById(deliveredOrder._id);
  assert(checkDelivOrder.orderStatus === "Delivered", "Delivered order status unchanged in database");

  // Clean up test data
  await Order.deleteMany({
    _id: { $in: [walletOrder._id, failedOrder._id, cancelTestOrder._id, deliveredOrder._id] },
  });
  await Product.deleteOne({ _id: testProduct._id });
  await Category.deleteOne({ _id: cat._id });

  console.log("\n===============================================================");
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED             `);
  console.log("===============================================================");

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
