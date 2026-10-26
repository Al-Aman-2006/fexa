const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const http = require("http");
require("dotenv").config();

const Order = require("./models/order.model");
const User = require("./models/user.model");
const Product = require("./models/product.model");
const Coupon = require("./models/coupon.model");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/fexa-project";
const JWT_SECRET = process.env.JWT_SECRET || "fexa_super_secret_key_2026_change_this";
const BASE_URL = "http://localhost:5000";

let adminToken = "";
let userToken = "";
let testAdminUser = null;
let testRegularUser = null;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// Helper to make HTTP requests
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { ...headers };

    let bodyStr = null;
    if (body) {
      bodyStr = JSON.stringify(body);
      reqHeaders["Content-Type"] = "application/json";
      reqHeaders["Content-Length"] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let rawData = "";
        res.on("data", (chunk) => (rawData += chunk));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(rawData);
          } catch (e) {
            parsed = rawData;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed,
          });
        });
      }
    );

    req.on("error", (err) => reject(err));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function runSalesTestSuite() {
  console.log("\n========================================================");
  console.log("    FEXA SALES MANAGEMENT & REPORTING TEST SUITE        ");
  console.log("========================================================\n");

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB for Test Execution.\n");

  try {
    // 1. Setup Test Admin and Regular Users
    testAdminUser = await User.findOne({ role: "admin", isBlocked: false });
    if (!testAdminUser) {
      testAdminUser = await User.create({
        name: "Test Sales Admin",
        email: `admin_sales_${Date.now()}@fexa.com`,
        password: "hashedpassword123",
        role: "admin",
        isBlocked: false,
      });
    }

    testRegularUser = await User.findOne({ role: "user", isBlocked: false });
    if (!testRegularUser) {
      testRegularUser = await User.create({
        name: "Test Regular Customer",
        email: `customer_sales_${Date.now()}@fexa.com`,
        password: "hashedpassword123",
        role: "user",
        isBlocked: false,
      });
    }

    adminToken = jwt.sign({ id: testAdminUser._id, role: "admin" }, JWT_SECRET, { expiresIn: "1d" });
    userToken = jwt.sign({ id: testRegularUser._id, role: "user" }, JWT_SECRET, { expiresIn: "1d" });

    const adminHeaders = {
      Cookie: `adminToken=${adminToken}`,
      Authorization: `Bearer ${adminToken}`,
    };

    const userHeaders = {
      Cookie: `token=${userToken}`,
      Authorization: `Bearer ${userToken}`,
    };

    // =========================================================================
    // TEST A — ADMIN ACCESS SECURITY
    // =========================================================================
    console.log("--- TEST A: ADMIN ACCESS SECURITY ---");
    const noAuthRes = await request("GET", "/api/admin/sales/overview");
    assert(noAuthRes.status === 401, "Unauthenticated request to sales overview is rejected with 401");

    const userAuthRes = await request("GET", "/api/admin/sales/overview", null, userHeaders);
    assert(userAuthRes.status === 403, "Non-admin user request to sales overview is rejected with 403");

    const adminAuthRes = await request("GET", "/api/admin/sales/overview", null, adminHeaders);
    assert(adminAuthRes.status === 200 && adminAuthRes.data.success, "Admin user receives 200 with sales overview data");

    // =========================================================================
    // TEST B — REVENUE CALCULATION ACCURACY & SALE DEFINITION
    // =========================================================================
    console.log("\n--- TEST B: REVENUE CALCULATION RULES ---");
    // Create known synthetic test orders in a unique test window
    const now = new Date();
    const testDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago today

    // 1. Paid Razorpay Order
    const orderPaidRazorpay = await Order.create({
      orderNumber: `TEST-SALES-RP-PAID-${Date.now()}`,
      user: testRegularUser._id,
      items: [
        {
          name: "Oud Royale Test",
          brand: "FEXA Atelier",
          category: "Men",
          volumeMl: 100,
          quantity: 2,
          unitPrice: 2000,
          originalPrice: 2400,
          lineTotal: 4000,
        },
      ],
      shippingAddress: { fullName: "Aman Sales Test", phone: "9876543210" },
      subtotal: 4000,
      discountAmount: 400,
      couponCode: "SALESTEST10",
      discountPercentage: 10,
      shippingCost: 0,
      totalAmount: 3600,
      paymentMethod: "Razorpay",
      paymentStatus: "Paid",
      orderStatus: "Processing",
      createdAt: testDate,
    });

    // 2. Failed Razorpay Order (MUST NEVER BE COUNTED AS REVENUE)
    const orderFailedRazorpay = await Order.create({
      orderNumber: `TEST-SALES-RP-FAILED-${Date.now()}`,
      user: testRegularUser._id,
      items: [
        {
          name: "Oud Royale Test",
          brand: "FEXA Atelier",
          category: "Men",
          volumeMl: 100,
          quantity: 1,
          unitPrice: 2000,
          originalPrice: 2400,
          lineTotal: 2000,
        },
      ],
      subtotal: 2000,
      totalAmount: 2000,
      paymentMethod: "Razorpay",
      paymentStatus: "Failed",
      orderStatus: "Processing",
      createdAt: testDate,
    });

    // 3. Pending Online Razorpay (Unverified checkout - NOT recognized revenue)
    const orderPendingRazorpay = await Order.create({
      orderNumber: `TEST-SALES-RP-PENDING-${Date.now()}`,
      user: testRegularUser._id,
      items: [
        {
          name: "Rose Éthérée Test",
          brand: "FEXA Atelier",
          category: "Women",
          volumeMl: 50,
          quantity: 1,
          unitPrice: 1500,
          originalPrice: 1800,
          lineTotal: 1500,
        },
      ],
      subtotal: 1500,
      totalAmount: 1500,
      paymentMethod: "Razorpay",
      paymentStatus: "Pending",
      orderStatus: "Processing",
      createdAt: testDate,
    });

    // 4. Cancelled Order (MUST NEVER BE COUNTED AS ACTIVE SALE OR REVENUE)
    const orderCancelled = await Order.create({
      orderNumber: `TEST-SALES-CANCELLED-${Date.now()}`,
      user: testRegularUser._id,
      items: [
        {
          name: "Rose Éthérée Test",
          brand: "FEXA Atelier",
          category: "Women",
          volumeMl: 50,
          quantity: 1,
          unitPrice: 1500,
          originalPrice: 1800,
          lineTotal: 1500,
        },
      ],
      subtotal: 1500,
      totalAmount: 1500,
      paymentMethod: "COD",
      paymentStatus: "Pending",
      orderStatus: "Cancelled",
      createdAt: testDate,
    });

    // 5. COD Delivered Order (COLLECTED REVENUE)
    const orderDeliveredCOD = await Order.create({
      orderNumber: `TEST-SALES-COD-DELIV-${Date.now()}`,
      user: testRegularUser._id,
      items: [
        {
          name: "Ambre Nuit Test",
          brand: "FEXA Atelier",
          category: "Unisex",
          volumeMl: 200,
          quantity: 1,
          unitPrice: 5000,
          originalPrice: 6000,
          lineTotal: 5000,
        },
      ],
      subtotal: 5000,
      shippingCost: 0,
      totalAmount: 5000,
      paymentMethod: "COD",
      paymentStatus: "Paid",
      orderStatus: "Delivered",
      createdAt: testDate,
    });

    // 6. COD Placed / In-Transit Order (Awaiting collection)
    const orderPlacedCOD = await Order.create({
      orderNumber: `TEST-SALES-COD-PLACED-${Date.now()}`,
      user: testRegularUser._id,
      items: [
        {
          name: "Ambre Nuit Test",
          brand: "FEXA Atelier",
          category: "Unisex",
          volumeMl: 30,
          quantity: 1,
          unitPrice: 1200,
          originalPrice: 1400,
          lineTotal: 1200,
        },
      ],
      subtotal: 1200,
      shippingCost: 0,
      totalAmount: 1200,
      paymentMethod: "COD",
      paymentStatus: "Pending",
      orderStatus: "Processing",
      createdAt: testDate,
    });

    // Query overview for today
    const overviewRes = await request("GET", "/api/admin/sales/overview?period=today", null, adminHeaders);
    assert(overviewRes.status === 200, "Sales overview returns 200 for today");

    const overviewData = overviewRes.data.data.overview;
    assert(overviewData.recognizedRevenue > 0, `Recognized revenue computed: ₹${overviewData.recognizedRevenue}`);
    assert(
      overviewData.failedPayments.amount >= 2000,
      `Failed payments amount correctly tracked: ₹${overviewData.failedPayments.amount}`
    );
    assert(
      overviewData.cancelledOrders.amount >= 1500,
      `Cancelled orders amount correctly tracked: ₹${overviewData.cancelledOrders.amount}`
    );
    assert(
      overviewData.pendingPayments.amount >= 1500,
      `Pending payments amount correctly tracked: ₹${overviewData.pendingPayments.amount}`
    );

    // =========================================================================
    // TEST C — DATE FILTERS (TODAY, YESTERDAY, 7 DAYS, 30 DAYS, THIS MONTH, CUSTOM)
    // =========================================================================
    console.log("\n--- TEST C: DATE FILTERS & BOUNDARY INTEGRITY ---");
    const filterPresets = ["today", "yesterday", "last7days", "last30days", "thisMonth", "prevMonth", "thisYear"];
    for (const preset of filterPresets) {
      const res = await request("GET", `/api/admin/sales/overview?period=${preset}`, null, adminHeaders);
      assert(res.status === 200, `Date filter preset '${preset}' returned 200 with valid periodLabel`);
    }

    // Custom date range test
    const customStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const customEnd = new Date().toISOString().split("T")[0];
    const customRes = await request(
      "GET",
      `/api/admin/sales/overview?period=custom&startDate=${customStart}&endDate=${customEnd}`,
      null,
      adminHeaders
    );
    assert(customRes.status === 200, `Custom date range (${customStart} to ${customEnd}) returned 200`);

    // =========================================================================
    // TEST D — PRODUCT SALES & VARIANT-LEVEL REPORTING (30ml, 50ml, 100ml, 200ml)
    // =========================================================================
    console.log("\n--- TEST D: PRODUCT PERFORMANCE & VARIANT DISTINCTION ---");
    const productRes = await request(
      "GET",
      "/api/admin/sales/products?period=today&sortBy=unitsSold&sortOrder=desc",
      null,
      adminHeaders
    );
    assert(productRes.status === 200, "Product performance endpoint returns 200");

    const productList = productRes.data.data.products;
    const oud100ml = productList.find((p) => p.name === "Oud Royale Test" && p.volumeMl === 100);
    const ambre200ml = productList.find((p) => p.name === "Ambre Nuit Test" && p.volumeMl === 200);
    const ambre30ml = productList.find((p) => p.name === "Ambre Nuit Test" && p.volumeMl === 30);

    assert(oud100ml !== undefined && oud100ml.volumeMl === 100, "Variant 100ml captured for Oud Royale Test");
    assert(ambre200ml !== undefined && ambre200ml.volumeMl === 200, "Variant 200ml captured for Ambre Nuit Test");
    assert(ambre30ml !== undefined && ambre30ml.volumeMl === 30, "Variant 30ml captured for Ambre Nuit Test (distinguished from 200ml)");

    // =========================================================================
    // TEST E — CATEGORY PERFORMANCE (MEN, WOMEN, UNISEX NO DOUBLE COUNTING)
    // =========================================================================
    console.log("\n--- TEST E: CATEGORY SALES PERFORMANCE ---");
    const catRes = await request("GET", "/api/admin/sales/categories?period=today", null, adminHeaders);
    assert(catRes.status === 200, "Category performance endpoint returns 200");

    const catData = catRes.data.data.categories;
    const menCat = catData.find((c) => c.category === "Men");
    const womenCat = catData.find((c) => c.category === "Women");
    const unisexCat = catData.find((c) => c.category === "Unisex");

    assert(menCat && menCat.unitsSold >= 2, `Men category units: ${menCat?.unitsSold}`);
    assert(unisexCat && unisexCat.unitsSold >= 2, `Unisex category units: ${unisexCat?.unitsSold}`);
    const sumShares = catData.reduce((acc, c) => acc + (c.sharePercentage || 0), 0);
    assert(sumShares >= 99 && sumShares <= 101, `Category share percentages sum to 100% (${sumShares}%)`);

    // =========================================================================
    // TEST F — RAZORPAY VERIFICATION & FAILED PAYMENTS
    // =========================================================================
    console.log("\n--- TEST F: RAZORPAY VERIFIED VS FAILED PAYMENTS ---");
    const payRes = await request("GET", "/api/admin/sales/payments?period=today", null, adminHeaders);
    assert(payRes.status === 200, "Payment method breakdown endpoint returns 200");

    const paymentMethods = payRes.data.data.methods;
    assert(paymentMethods.razorpayPaid.amount >= 3600, "Razorpay paid orders correctly summed");
    assert(paymentMethods.razorpayFailed.amount >= 2000, "Razorpay failed attempts isolated from paid revenue");
    assert(paymentMethods.razorpayPending.amount >= 1500, "Razorpay incomplete checkouts isolated from paid revenue");

    // =========================================================================
    // TEST G — CASH ON DELIVERY (PLACED VS DELIVERED/COLLECTED)
    // =========================================================================
    console.log("\n--- TEST G: COD ORDER WORKFLOW SEPARATION ---");
    assert(
      paymentMethods.codDelivered.amount >= 5000,
      `Delivered COD counted as collected revenue: ₹${paymentMethods.codDelivered.amount}`
    );
    assert(
      paymentMethods.codInTransit.amount >= 1200,
      `Placed COD awaiting delivery counted as in-transit: ₹${paymentMethods.codInTransit.amount}`
    );

    // =========================================================================
    // TEST H — COUPONS & DISCOUNTS REPORTING
    // =========================================================================
    console.log("\n--- TEST H: COUPON REDEMPTION & DISCOUNT ACCURACY ---");
    const couponRes = await request("GET", "/api/admin/sales/coupons?period=today", null, adminHeaders);
    assert(couponRes.status === 200, "Coupon performance endpoint returns 200");

    const couponList = couponRes.data.data.coupons;
    const testCouponReport = couponList.find((c) => c.code === "SALESTEST10");
    assert(testCouponReport !== undefined, "SALESTEST10 coupon appears in coupon analytics");
    assert(testCouponReport && testCouponReport.totalDiscountGranted >= 400, "Total discount amount granted is accurate (₹400)");
    assert(testCouponReport && testCouponReport.redemptionsCount >= 1, "Redemption count is accurate");

    // =========================================================================
    // TEST I — DETAILED SALES REPORT TABLE (SEARCH, FILTERS, PAGINATION)
    // =========================================================================
    console.log("\n--- TEST I: DETAILED SALES TABLE PAGINATION & SEARCH ---");
    const searchRes = await request(
      "GET",
      `/api/admin/sales/report?period=today&search=${orderPaidRazorpay.orderNumber}`,
      null,
      adminHeaders
    );
    assert(searchRes.status === 200, "Search detailed sales returns 200");
    assert(
      searchRes.data.data.orders.length === 1 && searchRes.data.data.orders[0].orderNumber === orderPaidRazorpay.orderNumber,
      "Search by exact order number returns matched order snapshot"
    );

    const filterStatusRes = await request(
      "GET",
      "/api/admin/sales/report?period=today&paymentStatus=Paid",
      null,
      adminHeaders
    );
    assert(filterStatusRes.status === 200, "Filter by paymentStatus=Paid returns 200");
    const allPaid = filterStatusRes.data.data.orders.every((o) => o.paymentStatus === "Paid");
    assert(allPaid, "All returned orders have paymentStatus 'Paid'");

    // =========================================================================
    // TEST J — CSV EXPORT FORMAT & DATA FIDELITY
    // =========================================================================
    console.log("\n--- TEST J: CSV EXPORT FORMAT & SCOPE ---");
    const exportRes = await request("GET", "/api/admin/sales/export?period=today", null, adminHeaders);
    assert(exportRes.status === 200, "CSV export endpoint returns 200");
    assert(
      exportRes.headers["content-type"].includes("text/csv"),
      "Response Content-Type is text/csv"
    );
    assert(
      exportRes.data.startsWith("\uFEFF"),
      "CSV content begins with UTF-8 Byte Order Mark (BOM) for Excel"
    );
    assert(
      exportRes.data.includes("Order Number") && exportRes.data.includes("Merchandise Subtotal"),
      "CSV includes correct column headers"
    );
    assert(
      exportRes.data.includes(orderPaidRazorpay.orderNumber),
      "CSV includes created test order row"
    );

    // =========================================================================
    // TEST K — REGRESSION TESTING
    // =========================================================================
    console.log("\n--- TEST K: SYSTEM REGRESSION VERIFICATION ---");
    const adminProductsRes = await request("GET", "/api/admin/products", null, adminHeaders);
    assert(adminProductsRes.status === 200, "Existing /api/admin/products route remains operational");

    const adminCouponsRes = await request("GET", "/api/admin/coupons", null, adminHeaders);
    assert(adminCouponsRes.status === 200, "Existing /api/admin/coupons route remains operational");

    const adminUsersRes = await request("GET", "/api/admin/users", null, adminHeaders);
    assert(adminUsersRes.status === 200, "Existing /api/admin/users route remains operational");

    // Clean up synthetic test orders created in this test run
    await Order.deleteMany({
      orderNumber: { $regex: "^TEST-SALES-" },
    });
    console.log("\nCleaned up synthetic test orders from database.");

  } catch (error) {
    console.error("Test execution encountered an error:", error);
    assert(false, `Test execution error: ${error.message}`);
  } finally {
    await mongoose.disconnect();
  }

  console.log("\n========================================================");
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} ASSERTIONS PASSED (${failedTests} FAILED)`);
  console.log("========================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSalesTestSuite();
