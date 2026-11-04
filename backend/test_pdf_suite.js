import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import http from "http";
import dotenv from "dotenv";
dotenv.config();

import Order from "./models/order.model.js";
import User from "./models/user.model.js";
import Product from "./models/product.model.js";
import Category from "./models/category.model.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fexa-project";
const JWT_SECRET = process.env.JWT_SECRET || "fexa_super_secret_key_2026_change_this";
const BASE_URL = "http://localhost:5000";

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

// Helper to make HTTP requests that return raw buffer and parsed JSON if possible
function requestBuffer(method, path, body = null, headers = {}) {
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
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          let parsed = null;
          try {
            parsed = JSON.parse(buffer.toString("utf8"));
          } catch (e) {
            parsed = null;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            buffer,
            text: buffer.toString("utf8"),
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

async function runPDFSuite() {
  console.log("\n========================================================");
  console.log("   FEXA PDF INVOICE & SALES EXPORT VERIFICATION SUITE   ");
  console.log("========================================================\n");

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB for Test Execution.\n");

  try {
    // 1. Setup Admin and Two Distinct Users
    let testAdmin = await User.findOne({ role: "admin", isBlocked: false });
    if (!testAdmin) {
      testAdmin = await User.create({
        name: "Test Admin",
        email: `admin_pdf_${Date.now()}@fexa.com`,
        password: "hashedpassword123",
        role: "admin",
        isBlocked: false,
      });
    }

    let userA = await User.findOne({ role: "user", isBlocked: false });
    if (!userA) {
      userA = await User.create({
        name: "Customer Alpha",
        email: `user_a_${Date.now()}@fexa.com`,
        password: "hashedpassword123",
        role: "user",
        isBlocked: false,
      });
    }

    const userB = await User.create({
      name: "Customer Beta",
      email: `user_b_${Date.now()}@fexa.com`,
      password: "hashedpassword123",
      role: "user",
      isBlocked: false,
    });

    const adminToken = jwt.sign({ id: testAdmin._id, role: "admin" }, JWT_SECRET, { expiresIn: "1d" });
    const userAToken = jwt.sign({ id: userA._id, role: "user" }, JWT_SECRET, { expiresIn: "1d" });
    const userBToken = jwt.sign({ id: userB._id, role: "user" }, JWT_SECRET, { expiresIn: "1d" });

    const adminHeaders = {
      Cookie: `adminToken=${adminToken}`,
      Authorization: `Bearer ${adminToken}`,
    };

    const userAHeaders = {
      Cookie: `token=${userAToken}`,
      Authorization: `Bearer ${userAToken}`,
    };

    const userBHeaders = {
      Cookie: `token=${userBToken}`,
      Authorization: `Bearer ${userBToken}`,
    };

    // 2. Setup Category and Product
    let category = await Category.findOne();
    if (!category) {
      category = await Category.create({
        name: "Luxury Fragrance",
        slug: `fragrance-${Date.now()}`,
        status: "Active",
      });
    }

    let product = await Product.findOne();
    if (!product) {
      product = await Product.create({
        name: "Oud Royale EDP",
        category: category._id,
        price: 2400,
        variants: [
          {
            volume: 100,
            regularPrice: 2400,
            sellingPrice: 1999,
            stock: 25,
            sku: `OUD-100-${Date.now()}`,
          },
        ],
      });
    }

    // 3. Create a Test Order belonging to User A
    const orderNum = `FX-ORD-${Date.now().toString().slice(-6)}`;
    const testOrder = await Order.create({
      orderNumber: orderNum,
      user: userA._id,
      items: [
        {
          product: product._id,
          variantId: product.variants[0]._id,
          name: product.name,
          volumeMl: 100,
          quantity: 2,
          unitPrice: 1999,
          originalPrice: 2400,
          lineTotal: 3998,
          originalLineAmount: 4800,
          allocatedCouponDiscount: 200,
          discountedLineAmount: 3798,
          itemStatus: "Active",
        },
      ],
      shippingAddress: {
        fullName: "Customer Alpha",
        phone: "9876543210",
        addressLine: "42 Park Avenue, Atelier Suite 7",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      },
      paymentMethod: "Razorpay",
      paymentStatus: "Paid",
      orderStatus: "Delivered",
      originalSubtotal: 4800,
      subtotal: 3998,
      shippingCost: 150,
      discountAmount: 200,
      totalAmount: 3948,
      createdAt: new Date(),
    });

    console.log("--- TEST GROUP 1: User-Side Order Invoice Download ---");
    // Test 1: User A downloads own invoice
    const resUserA = await requestBuffer("GET", `/api/orders/${testOrder._id}/invoice`, null, userAHeaders);
    assert(resUserA.status === 200, "User A can successfully download own invoice (HTTP 200)");
    assert(resUserA.headers["content-type"] === "application/pdf", "Response content-type is application/pdf");
    assert(
      (resUserA.headers["content-disposition"] || "").includes(`FEXA-Invoice-${testOrder.orderNumber}.pdf`),
      "Content-Disposition header includes correct filename"
    );
    assert(
      resUserA.buffer.subarray(0, 4).toString("ascii") === "%PDF",
      "PDF buffer starts with authentic %PDF magic header"
    );
    assert(resUserA.buffer.length > 2000, `PDF generated with substantial content (${resUserA.buffer.length} bytes)`);

    console.log("\n--- TEST GROUP 2: Security & Cross-User Access Control ---");
    // Test 2: User B tries to download User A's invoice
    const resUserB = await requestBuffer("GET", `/api/orders/${testOrder._id}/invoice`, null, userBHeaders);
    assert(resUserB.status === 403, "User B is denied access to User A's invoice (HTTP 403 Forbidden)");
    assert(resUserB.data && resUserB.data.success === false, "Security error response format is valid JSON");

    // Test 3: Unauthenticated user is rejected
    const resUnauth = await requestBuffer("GET", `/api/orders/${testOrder._id}/invoice`, null, {});
    assert(resUnauth.status === 401, "Unauthenticated access rejected (HTTP 401 Unauthorized)");

    console.log("\n--- TEST GROUP 3: Admin-Side Order Invoice Download ---");
    // Test 4: Admin downloads order invoice
    const resAdminOrder = await requestBuffer("GET", `/api/admin/orders/${testOrder._id}/invoice`, null, adminHeaders);
    assert(resAdminOrder.status === 200, "Admin can download any order invoice (HTTP 200)");
    assert(resAdminOrder.headers["content-type"] === "application/pdf", "Admin invoice content-type is application/pdf");
    assert(
      resAdminOrder.buffer.subarray(0, 4).toString("ascii") === "%PDF",
      "Admin invoice buffer starts with %PDF"
    );

    console.log("\n--- TEST GROUP 4: Admin-Side Sales Report PDF Export ---");
    // Test 5: Admin exports sales report PDF with date filter
    const resSalesPDF = await requestBuffer("GET", "/api/admin/sales/export-pdf?period=thisMonth", null, adminHeaders);
    assert(resSalesPDF.status === 200, "Admin sales report PDF returns HTTP 200");
    assert(resSalesPDF.headers["content-type"] === "application/pdf", "Sales report content-type is application/pdf");
    assert(
      (resSalesPDF.headers["content-disposition"] || "").includes("FEXA-Sales-Report-"),
      "Sales report Content-Disposition includes proper filename"
    );
    assert(
      resSalesPDF.buffer.subarray(0, 4).toString("ascii") === "%PDF",
      "Sales report buffer starts with authentic %PDF header"
    );
    assert(resSalesPDF.buffer.length > 2000, `Sales report PDF generated (${resSalesPDF.buffer.length} bytes)`);

    console.log("\n--- TEST GROUP 5: Preserving Existing CSV Sales Export ---");
    // Test 6: Verify existing CSV export still works flawlessly
    const resSalesCSV = await requestBuffer("GET", "/api/admin/sales/export?period=thisMonth", null, adminHeaders);
    assert(resSalesCSV.status === 200, "Admin sales CSV export returns HTTP 200");
    assert(
      (resSalesCSV.headers["content-type"] || "").includes("text/csv"),
      "CSV export content-type is text/csv"
    );
    assert(
      resSalesCSV.text.includes("Order Number") && resSalesCSV.text.includes("Final Order Amount (INR)"),
      "CSV contains standard executive sales report headers"
    );

    // Cleanup created test records
    await Order.findByIdAndDelete(testOrder._id);
    await User.findByIdAndDelete(userB._id);

    console.log("\n========================================================");
    console.log(`TEST RESULTS: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log("========================================================\n");

    if (failedTests === 0) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runPDFSuite();
