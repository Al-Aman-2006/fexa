import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

import Order from "../../models/order.model.js";
import Wallet from "../../models/wallet.model.js";
import User from "../../models/user.model.js";
import Category from "../../models/category.model.js";
import {
  getSalesOverview,
  getSalesTrends,
  getProductPerformance,
  getCategoryPerformance,
  getPaymentMethodBreakdown,
  getCouponPerformance,
  getDetailedSalesReport,
  exportSalesReportCSV,
} from "../../controllers/sales.controller.js";
import { updateOrderStatus } from "../../controllers/adminOrder.controller.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// Mock Response Helper
const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
    send(content) {
      this.body = content;
      return this;
    },
    setHeader(name, val) {
      this.headers[name] = val;
    },
  };
  return res;
};

async function runTestSuite() {
  console.log("=================================================================");
  console.log("       FEXA SALES REPORT & ORDER STATUS SYNC TEST SUITE          ");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✓ Connected to MongoDB Atlas\n");

    // -------------------------------------------------------------
    // TEST SUITE 1: SALES OVERVIEW METRICS VERIFICATION
    // -------------------------------------------------------------
    console.log("--- TEST SUITE 1: SALES OVERVIEW METRICS ---");

    const reqOverview = {
      query: { period: "thisYear" },
    };
    const resOverview = createMockRes();
    await getSalesOverview(reqOverview, resOverview);

    assert(resOverview.statusCode === 200, "getSalesOverview returns HTTP 200");
    assert(resOverview.data?.success === true, "getSalesOverview response indicates success");

    const overview = resOverview.data?.data?.overview;
    assert(overview !== undefined, "Sales overview object is present");
    assert(typeof overview?.totalGrossSales === "number", "totalGrossSales is a valid number");
    assert(typeof overview?.totalNetRevenue === "number", "totalNetRevenue is a valid number");
    assert(typeof overview?.totalOrders === "number", "totalOrders is a valid number");
    assert(typeof overview?.successfulOrdersCount === "number", "successfulOrdersCount is a valid number");
    assert(typeof overview?.cancelledOrdersCount === "number", "cancelledOrdersCount is a valid number");
    assert(typeof overview?.returnedOrdersCount === "number", "returnedOrdersCount is a valid number");
    assert(typeof overview?.totalRefunds === "number", "totalRefunds is a valid number");
    assert(typeof overview?.totalDiscounts === "number", "totalDiscounts is a valid number");
    assert(typeof overview?.couponDiscounts === "number", "couponDiscounts is a valid number");
    assert(typeof overview?.automaticOfferDiscounts === "number", "automaticOfferDiscounts is a valid number");
    assert(typeof overview?.totalShippingRevenue === "number", "totalShippingRevenue is a valid number");
    assert(typeof overview?.averageOrderValue === "number", "averageOrderValue is a valid number");

    // Mathematical integrity check: totalDiscounts === couponDiscounts + automaticOfferDiscounts
    const sumDiscounts = Math.round((overview.couponDiscounts + overview.automaticOfferDiscounts) * 100) / 100;
    assert(overview.totalDiscounts === sumDiscounts, `totalDiscounts (${overview.totalDiscounts}) equals sum of coupon & offer discounts (${sumDiscounts})`);

    // -------------------------------------------------------------
    // TEST SUITE 2: CONTIGUOUS DATE-WISE SALES TRENDS
    // -------------------------------------------------------------
    console.log("\n--- TEST SUITE 2: CONTIGUOUS SALES TRENDS GRAPH ---");

    const reqTrends = { query: { period: "last7days" } };
    const resTrends = createMockRes();
    await getSalesTrends(reqTrends, resTrends);

    assert(resTrends.statusCode === 200, "getSalesTrends returns HTTP 200");
    assert(Array.isArray(resTrends.data?.data?.series), "getSalesTrends returns contiguous series array");
    assert(resTrends.data?.data?.series?.length === 7, `Last 7 days series has exactly 7 daily points (got ${resTrends.data?.data?.series?.length})`);

    const firstPt = resTrends.data?.data?.series?.[0];
    assert(typeof firstPt?.revenue === "number", "Data point contains numeric revenue");
    assert(typeof firstPt?.orderCount === "number", "Data point contains numeric orderCount");

    // -------------------------------------------------------------
    // TEST SUITE 3: PAYMENT METHODS BREAKDOWN (RAZORPAY, WALLET, COD)
    // -------------------------------------------------------------
    console.log("\n--- TEST SUITE 3: PAYMENT METHOD BREAKDOWN ---");

    const reqPayments = { query: { period: "thisYear" } };
    const resPayments = createMockRes();
    await getPaymentMethodBreakdown(reqPayments, resPayments);

    assert(resPayments.statusCode === 200, "getPaymentMethodBreakdown returns HTTP 200");
    const methods = resPayments.data?.data?.methods;
    assert(methods?.razorpay !== undefined, "Razorpay payment bucket exists");
    assert(methods?.wallet !== undefined, "FEXA Wallet payment bucket exists");
    assert(methods?.cod !== undefined, "COD payment bucket exists");

    assert(typeof methods.wallet.successful?.amount === "number", "Wallet successful amount is tracked");
    assert(typeof methods.wallet.refunded?.amount === "number", "Wallet refunds are tracked");
    assert(typeof methods.razorpay.successful?.amount === "number", "Razorpay successful captures are tracked");
    assert(typeof methods.cod.successful?.amount === "number", "COD fulfilled deliveries are tracked");

    // -------------------------------------------------------------
    // TEST SUITE 4: DYNAMIC CATEGORY PERFORMANCE
    // -------------------------------------------------------------
    console.log("\n--- TEST SUITE 4: DYNAMIC CATEGORY PERFORMANCE ---");

    const reqCats = { query: { period: "thisYear" } };
    const resCats = createMockRes();
    await getCategoryPerformance(reqCats, resCats);

    assert(resCats.statusCode === 200, "getCategoryPerformance returns HTTP 200");
    const catList = resCats.data?.data?.categories;
    assert(Array.isArray(catList), "Categories list is an array");
    const hasMen = catList.some((c) => c.category === "Men");
    const hasWomen = catList.some((c) => c.category === "Women");
    const hasUnisex = catList.some((c) => c.category === "Unisex");
    assert(hasMen && hasWomen && hasUnisex, "Standard categories Men, Women, and Unisex are all included");

    // -------------------------------------------------------------
    // TEST SUITE 5: PRODUCT & VARIANT PERFORMANCE
    // -------------------------------------------------------------
    console.log("\n--- TEST SUITE 5: PRODUCT PERFORMANCE ---");

    const reqProds = { query: { period: "thisYear", limit: 5 } };
    const resProds = createMockRes();
    await getProductPerformance(reqProds, resProds);

    assert(resProds.statusCode === 200, "getProductPerformance returns HTTP 200");
    assert(Array.isArray(resProds.data?.data?.products), "Product performance list is an array");
    if (resProds.data?.data?.products?.length > 0) {
      const p = resProds.data.data.products[0];
      assert(typeof p.name === "string", "Product variant has name");
      assert(typeof p.unitsSold === "number", "Product variant has unitsSold");
      assert(typeof p.grossSales === "number", "Product variant has grossSales");
      assert(typeof p.netSales === "number", "Product variant has netSales");
    }

    // -------------------------------------------------------------
    // TEST SUITE 6: CSV EXPORT STREAMING & COLUMNS
    // -------------------------------------------------------------
    console.log("\n--- TEST SUITE 6: CSV EXPORT STREAMING ---");

    const reqCsv = { query: { period: "thisMonth" } };
    const resCsv = createMockRes();
    await exportSalesReportCSV(reqCsv, resCsv);

    assert(resCsv.statusCode === 200, "exportSalesReportCSV returns HTTP 200");
    assert(resCsv.headers["Content-Type"]?.includes("text/csv"), "CSV content type header set properly");
    assert(typeof resCsv.body === "string" && resCsv.body.includes("Order Number"), "CSV body contains headers");
    assert(resCsv.body.includes("Final Order Amount (INR)"), "CSV body contains Final Order Amount header");

    // -------------------------------------------------------------
    // TEST SUITE 7: ORDER STATUS TRANSITION RESTRICTIONS
    // -------------------------------------------------------------
    console.log("\n--- TEST SUITE 7: ORDER STATUS TRANSITION GUARDS ---");

    // Admin should NOT be allowed to transition an order to "Return Requested"
    const reqInvalidTransition = {
      params: { orderId: new mongoose.Types.ObjectId().toString() },
      body: { status: "Return Requested" },
      admin: { email: "admin@fexa.com" },
    };
    const resInvalidTransition = createMockRes();
    await updateOrderStatus(reqInvalidTransition, resInvalidTransition);

    assert(resInvalidTransition.statusCode === 400, "Transitioning to 'Return Requested' by admin is rejected with HTTP 400");
    assert(
      resInvalidTransition.data?.message?.includes("Return requests must be initiated exclusively by the customer"),
      "Helpful error message informs admin that return requests are customer-side only"
    );

    console.log("\n=================================================================");
    console.log(`TEST SUITE SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log("=================================================================");

    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("Test execution error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTestSuite();
