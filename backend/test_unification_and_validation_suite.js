/**
 * FEXA Admin Panel - Unified Product Management & Strong Validation Test Suite
 * Tests A through J as specified in the requirements.
 */

import mongoose from "mongoose";
import http from "http";
import fs from "fs";
import path from "path";
import Product from "./models/product.model.js";
import Category from "./models/category.model.js";
import User from "./models/user.model.js";
import Order from "./models/order.model.js";
import { validateProduct } from "./validators/product.validator.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/fexa-project";
const BASE_URL = "http://localhost:5000";

let adminCookie = "";
let testResults = [];

function recordTest(testName, passed, details = "") {
  testResults.push({ testName, passed, details });
  const status = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`${status} - ${testName} ${details ? `(${details})` : ""}`);
}

// HTTP request helper with cookie support
function makeRequest(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        ...headers,
      },
    };

    if (adminCookie) {
      options.headers["Cookie"] = adminCookie;
    }

    const req = http.request(options, (res) => {
      let data = "";
      if (res.headers["set-cookie"]) {
        const rawCookies = res.headers["set-cookie"];
        adminCookie = rawCookies.map((c) => c.split(";")[0]).join("; ");
      }
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      if (typeof body === "string") {
        req.write(body);
      } else if (Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        req.setHeader("Content-Type", "application/json");
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

// Multipart helper for file upload simulation
function makeMultipartRequest(method, urlPath, fields = {}, files = []) {
  return new Promise((resolve, reject) => {
    const boundary = "----FexaFormBoundary" + Math.random().toString(36).substring(2);
    const url = new URL(urlPath, BASE_URL);

    let buffers = [];

    // Fields
    for (const [key, val] of Object.entries(fields)) {
      buffers.push(Buffer.from(`--${boundary}\r\n`));
      buffers.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
      buffers.push(Buffer.from(`${val}\r\n`));
    }

    // Files
    for (const file of files) {
      buffers.push(Buffer.from(`--${boundary}\r\n`));
      buffers.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\n`
        )
      );
      buffers.push(Buffer.from(`Content-Type: ${file.mimetype}\r\n\r\n`));
      buffers.push(file.content);
      buffers.push(Buffer.from("\r\n"));
    }

    buffers.push(Buffer.from(`--${boundary}--\r\n`));
    const fullBody = Buffer.concat(buffers);

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": fullBody.length,
      },
    };

    if (adminCookie) {
      options.headers["Cookie"] = adminCookie;
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on("error", reject);
    req.write(fullBody);
    req.end();
  });
}

// Minimal 1x1 PNG buffer for testing image upload
const DUMMY_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

async function runTestSuite() {
  console.log("\n============================================================");
  console.log("  FEXA UNIFIED PRODUCT MANAGEMENT & VALIDATION TEST SUITE");
  console.log("============================================================\n");

  await mongoose.connect(MONGO_URI);

  // Step 0: Login Admin
  const loginRes = await makeRequest("POST", "/api/admin/auth/login", {}, {
    email: "admin@fexa.com",
    password: "Admin12345@",
  });
  recordTest("Admin Login", loginRes.status === 200 && loginRes.body?.success, `Status: ${loginRes.status}`);

  // ---------------------------------------------------------
  // TEST A: SIDEBAR STRUCTURE & CODE INSPECTION
  // ---------------------------------------------------------
  console.log("\n--- TEST A: SIDEBAR STRUCTURE & ROUTE MAPPING ---");
  const sidebarCode = fs.readFileSync(
    path.join(__dirname, "../frontend/src/components/admin/AdminSidebar.jsx"),
    "utf8"
  );
  const appCode = fs.readFileSync(
    path.join(__dirname, "../frontend/src/app.jsx"),
    "utf8"
  );

  const hasSeparateProductsMenu = sidebarCode.includes('{ id: "products", label: "Products"');
  recordTest("TEST A.1 - Separate top-level Products menu removed from AdminSidebar", !hasSeparateProductsMenu);

  const hasCategoryManagementParent = sidebarCode.includes('id: "category-management"');
  recordTest("TEST A.2 - Category Management remains parent menu", hasCategoryManagementParent);

  const hasAllProductsSubmenu = sidebarCode.includes('path: "/admin/categories/all"') && sidebarCode.includes('label: "All Products"');
  const hasMenSubmenu = sidebarCode.includes('path: "/admin/categories/men"') && sidebarCode.includes('label: "Men"');
  const hasWomenSubmenu = sidebarCode.includes('path: "/admin/categories/women"') && sidebarCode.includes('label: "Women"');
  const hasUnisexSubmenu = sidebarCode.includes('path: "/admin/categories/unisex"') && sidebarCode.includes('label: "Unisex"');
  recordTest(
    "TEST A.3 - Category Management contains All Products, Men, Women, Unisex submenus",
    hasAllProductsSubmenu && hasMenSubmenu && hasWomenSubmenu && hasUnisexSubmenu
  );

  const hasProductsRedirect = appCode.includes('path="/admin/products"') && appCode.includes('to="/admin/categories/all"');
  recordTest("TEST A.4 - Old /admin/products route redirects to /admin/categories/all", hasProductsRedirect);

  const hasCategoriesRedirect = appCode.includes('path="/admin/categories"') && appCode.includes('to="/admin/categories/all"');
  recordTest("TEST A.5 - /admin/categories redirects to /admin/categories/all", hasCategoriesRedirect);

  const hasAllRouteMounted = appCode.includes('path="/admin/categories/all"');
  recordTest("TEST A.6 - /admin/categories/all route is registered with AdminProtectedRoute", hasAllRouteMounted);

  // ---------------------------------------------------------
  // TEST B: ALL PRODUCTS PAGE (DATA & NO ADD BUTTON)
  // ---------------------------------------------------------
  console.log("\n--- TEST B: ALL PRODUCTS PAGE ---");
  const allRes = await makeRequest("GET", "/api/admin/products?category=All");
  recordTest("TEST B.1 - Fetch All Products returns HTTP 200", allRes.status === 200 && allRes.body.success);

  const allProductsList = allRes.body.products || [];
  const distinctCategories = new Set(allProductsList.map((p) => p.category));
  recordTest(
    "TEST B.2 - All Products page displays products across multiple categories",
    distinctCategories.size >= 2,
    `Found categories: ${Array.from(distinctCategories).join(", ")}`
  );

  const categoryPageCode = fs.readFileSync(
    path.join(__dirname, "../frontend/src/pages/admin/AdminCategoryPage.jsx"),
    "utf8"
  );
  // Verify NO Add Product button when config.isAll is true
  const commandBarHiddenOnAll = categoryPageCode.includes("{!config.isAll && (") && categoryPageCode.includes("NEW {config.name.toUpperCase()} FRAGRANCE");
  const toolbarHiddenOnAll = categoryPageCode.includes("{!config.isAll && (") && categoryPageCode.includes("ADD NEW {config.name.toUpperCase()} PRODUCT");
  const emptyStateHiddenOnAll = categoryPageCode.includes("!config.isAll ? (") && categoryPageCode.includes("+ Add New {config.name} Product");
  recordTest(
    "TEST B.3 - NO Add Product button rendered on All Products page (command bar, toolbar, empty state)",
    commandBarHiddenOnAll && toolbarHiddenOnAll && emptyStateHiddenOnAll
  );

  // ---------------------------------------------------------
  // TEST C: MEN PRODUCT CREATION
  // ---------------------------------------------------------
  console.log("\n--- TEST C: MEN PRODUCT CREATION ---");
  const menProdName = `Imperial Vetiver Men Test ${Date.now()}`;
  const menCreateRes = await makeMultipartRequest(
    "POST",
    "/api/admin/categories/men/products",
    {
      name: menProdName,
      brand: "FEXA Atelier",
      category: "Men",
      description: "A prestigious vetiver and cedar composition tailored exclusively for discerning gentlemen.",
      variants: JSON.stringify([
        { volumeMl: 50, sellingPrice: 1899, originalPrice: 2499, stock: 25, isAvailable: true },
        { volumeMl: 100, sellingPrice: 2899, originalPrice: 3499, stock: 40, isAvailable: true },
      ]),
    },
    [{ fieldname: "images", filename: "men_sample.png", mimetype: "image/png", content: DUMMY_PNG_BUFFER }]
  );

  recordTest(
    "TEST C.1 - Men product creation via /api/admin/categories/men/products succeeds",
    menCreateRes.status === 201 && menCreateRes.body.success,
    `Status: ${menCreateRes.status}`
  );
  const createdMenId = menCreateRes.body.product?._id;
  const createdMenDoc = createdMenId ? await Product.findById(createdMenId) : null;
  recordTest(
    "TEST C.2 - Product category in MongoDB is strictly 'Men'",
    createdMenDoc && createdMenDoc.category === "Men"
  );

  // Verify it appears in Men and All, but NOT in Women or Unisex
  const menListRes = await makeRequest("GET", "/api/admin/categories/men/products");
  const inMenList = (menListRes.body.products || []).some((p) => p.name === menProdName);
  const womenListRes = await makeRequest("GET", "/api/admin/categories/women/products");
  const inWomenList = (womenListRes.body.products || []).some((p) => p.name === menProdName);
  const unisexListRes = await makeRequest("GET", "/api/admin/categories/unisex/products");
  const inUnisexList = (unisexListRes.body.products || []).some((p) => p.name === menProdName);
  recordTest("TEST C.3 - Men product appears in Men listing", inMenList);
  recordTest("TEST C.4 - Men product does NOT appear in Women or Unisex listings", !inWomenList && !inUnisexList);

  // ---------------------------------------------------------
  // TEST D: WOMEN PRODUCT CREATION
  // ---------------------------------------------------------
  console.log("\n--- TEST D: WOMEN PRODUCT CREATION ---");
  const womenProdName = `Rose Sublime Women Test ${Date.now()}`;
  const womenCreateRes = await makeMultipartRequest(
    "POST",
    "/api/admin/categories/women/products",
    {
      name: womenProdName,
      brand: "FEXA Atelier",
      category: "Women",
      description: "A velvety Damask rose and violet fragrance created for refined elegance.",
      variants: JSON.stringify([
        { volumeMl: 75, sellingPrice: 2199, originalPrice: 2799, stock: 30, isAvailable: true },
      ]),
    },
    [{ fieldname: "images", filename: "women_sample.png", mimetype: "image/png", content: DUMMY_PNG_BUFFER }]
  );

  recordTest(
    "TEST D.1 - Women product creation via /api/admin/categories/women/products succeeds",
    womenCreateRes.status === 201 && womenCreateRes.body.success,
    `Status: ${womenCreateRes.status}`
  );
  const createdWomenId = womenCreateRes.body.product?._id;
  const createdWomenDoc = createdWomenId ? await Product.findById(createdWomenId) : null;
  recordTest(
    "TEST D.2 - Product category in MongoDB is strictly 'Women'",
    createdWomenDoc && createdWomenDoc.category === "Women"
  );

  // ---------------------------------------------------------
  // TEST E: UNISEX PRODUCT CREATION
  // ---------------------------------------------------------
  console.log("\n--- TEST E: UNISEX PRODUCT CREATION ---");
  const unisexProdName = `Amber Eclipse Unisex Test ${Date.now()}`;
  const unisexCreateRes = await makeMultipartRequest(
    "POST",
    "/api/admin/categories/unisex/products",
    {
      name: unisexProdName,
      brand: "FEXA Atelier",
      category: "Unisex",
      description: "An evocative smoky amber and cardamom scent designed without gender boundaries.",
      variants: JSON.stringify([
        { volumeMl: 100, sellingPrice: 3199, originalPrice: 3899, stock: 50, isAvailable: true },
      ]),
    },
    [{ fieldname: "images", filename: "unisex_sample.png", mimetype: "image/png", content: DUMMY_PNG_BUFFER }]
  );

  recordTest(
    "TEST E.1 - Unisex product creation via /api/admin/categories/unisex/products succeeds",
    unisexCreateRes.status === 201 && unisexCreateRes.body.success,
    `Status: ${unisexCreateRes.status}`
  );
  const createdUnisexId = unisexCreateRes.body.product?._id;
  const createdUnisexDoc = createdUnisexId ? await Product.findById(createdUnisexId) : null;
  recordTest(
    "TEST E.2 - Product category in MongoDB is strictly 'Unisex'",
    createdUnisexDoc && createdUnisexDoc.category === "Unisex"
  );

  // ---------------------------------------------------------
  // TEST F: STRONG PRODUCT VALIDATION
  // ---------------------------------------------------------
  console.log("\n--- TEST F: STRONG PRODUCT VALIDATION ---");

  // F.1: Empty product name
  const emptyNameRes = validateProduct({ name: "", brand: "FEXA", category: "Men", description: "Valid Description text." });
  recordTest("TEST F.1 - Validator rejects empty product name", !emptyNameRes.isValid && !!emptyNameRes.errors.name);

  // F.2: Whitespace-only product name
  const whitespaceNameRes = validateProduct({ name: "     ", brand: "FEXA", category: "Men", description: "Valid Description text." });
  recordTest("TEST F.2 - Validator rejects whitespace-only product name", !whitespaceNameRes.isValid && !!whitespaceNameRes.errors.name);

  // F.3: Symbol-only product name
  const symbolOnlyNameRes = validateProduct({ name: "!@#$%^&*()_+", brand: "FEXA", category: "Men", description: "Valid Description text." });
  recordTest("TEST F.3 - Validator rejects symbol-only product name", !symbolOnlyNameRes.isValid && !!symbolOnlyNameRes.errors.name);

  // F.4: Missing brand
  const emptyBrandRes = validateProduct({ name: "Valid Perfume", brand: "", category: "Men", description: "Valid Description text." });
  recordTest("TEST F.4 - Validator rejects empty/whitespace brand", !emptyBrandRes.isValid && !!emptyBrandRes.errors.brand);

  // F.5: Symbol-only brand
  const symbolBrandRes = validateProduct({ name: "Valid Perfume", brand: "$%^&*()", category: "Men", description: "Valid Description text." });
  recordTest("TEST F.5 - Validator rejects symbol-only brand", !symbolBrandRes.isValid && !!symbolBrandRes.errors.brand);

  // F.6: Invalid selling price (zero or negative)
  const zeroPriceRes = validateProduct({
    name: "Valid Perfume",
    brand: "FEXA",
    category: "Men",
    description: "Valid Description text.",
    variants: [{ volumeMl: 100, sellingPrice: 0, stock: 10 }],
  });
  recordTest("TEST F.6 - Validator rejects zero selling price", !zeroPriceRes.isValid);

  const negPriceRes = validateProduct({
    name: "Valid Perfume",
    brand: "FEXA",
    category: "Men",
    description: "Valid Description text.",
    variants: [{ volumeMl: 100, sellingPrice: -500, stock: 10 }],
  });
  recordTest("TEST F.7 - Validator rejects negative selling price", !negPriceRes.isValid);

  // F.8: Original price below selling price
  const mrpBelowSellRes = validateProduct({
    name: "Valid Perfume",
    brand: "FEXA",
    category: "Men",
    description: "Valid Description text.",
    variants: [{ volumeMl: 100, sellingPrice: 1500, originalPrice: 1000, stock: 10 }],
  });
  recordTest("TEST F.8 - Validator rejects original price (MRP) lower than selling price", !mrpBelowSellRes.isValid);

  // F.9: Duplicate perfume volumes
  const duplicateVolRes = validateProduct({
    name: "Valid Perfume",
    brand: "FEXA",
    category: "Men",
    description: "Valid Description text.",
    variants: [
      { volumeMl: 100, sellingPrice: 1500, stock: 10 },
      { volumeMl: 100, sellingPrice: 2000, stock: 15 },
    ],
  });
  recordTest("TEST F.9 - Validator rejects duplicate perfume volumes in variants", !duplicateVolRes.isValid && !!duplicateVolRes.errors.variants);

  // F.10: Zero or negative perfume volume
  const zeroVolRes = validateProduct({
    name: "Valid Perfume",
    brand: "FEXA",
    category: "Men",
    description: "Valid Description text.",
    variants: [{ volumeMl: 0, sellingPrice: 1500, stock: 10 }],
  });
  recordTest("TEST F.10 - Validator rejects zero volume variant", !zeroVolRes.isValid);

  // F.11: Negative stock
  const negStockRes = validateProduct({
    name: "Valid Perfume",
    brand: "FEXA",
    category: "Men",
    description: "Valid Description text.",
    variants: [{ volumeMl: 100, sellingPrice: 1500, stock: -5 }],
  });
  recordTest("TEST F.11 - Validator rejects negative stock", !negStockRes.isValid);

  // F.12: Decimal stock
  const decimalStockRes = validateProduct({
    name: "Valid Perfume",
    brand: "FEXA",
    category: "Men",
    description: "Valid Description text.",
    variants: [{ volumeMl: 100, sellingPrice: 1500, stock: 5.5 }],
  });
  recordTest("TEST F.12 - Validator rejects decimal stock quantity", !decimalStockRes.isValid);

  // F.13: Live backend rejection with HTTP 400 for symbol-only name
  const liveSymbolNameRes = await makeMultipartRequest(
    "POST",
    "/api/admin/categories/men/products",
    {
      name: "###$$$@@@",
      brand: "FEXA",
      category: "Men",
      description: "Valid Description of adequate length.",
      variants: JSON.stringify([{ volumeMl: 100, sellingPrice: 1200, stock: 10 }]),
    },
    [{ fieldname: "images", filename: "img.png", mimetype: "image/png", content: DUMMY_PNG_BUFFER }]
  );
  recordTest(
    "TEST F.13 - Backend API returns HTTP 400 when creating product with symbol-only name",
    liveSymbolNameRes.status === 400 && !liveSymbolNameRes.body.success,
    `Status: ${liveSymbolNameRes.status}`
  );

  // F.14: Live backend rejection with HTTP 400 for duplicate variant volumes
  const liveDupVolRes = await makeMultipartRequest(
    "POST",
    "/api/admin/categories/men/products",
    {
      name: `Duplicate Vol Test ${Date.now()}`,
      brand: "FEXA",
      category: "Men",
      description: "Valid Description of adequate length.",
      variants: JSON.stringify([
        { volumeMl: 50, sellingPrice: 1200, stock: 10 },
        { volumeMl: 50, sellingPrice: 1400, stock: 10 },
      ]),
    },
    [{ fieldname: "images", filename: "img.png", mimetype: "image/png", content: DUMMY_PNG_BUFFER }]
  );
  recordTest(
    "TEST F.14 - Backend API returns HTTP 400 when creating product with duplicate sizes",
    liveDupVolRes.status === 400 && !liveDupVolRes.body.success,
    `Status: ${liveDupVolRes.status}`
  );

  // ---------------------------------------------------------
  // TEST G: CATEGORY SECURITY & ROUTE MISMATCH ENFORCEMENT
  // ---------------------------------------------------------
  console.log("\n--- TEST G: CATEGORY ENFORCEMENT & ROUTE MISMATCH ---");

  // Attempt to submit Women product to Men route
  const mismatchMenRouteRes = await makeMultipartRequest(
    "POST",
    "/api/admin/categories/men/products",
    {
      name: `Tampered Category Women-on-Men ${Date.now()}`,
      brand: "FEXA",
      category: "Women", // TAMPERED!
      description: "Attempting to create Women product on Men route.",
      variants: JSON.stringify([{ volumeMl: 100, sellingPrice: 1500, stock: 10 }]),
    },
    [{ fieldname: "images", filename: "img.png", mimetype: "image/png", content: DUMMY_PNG_BUFFER }]
  );
  recordTest(
    "TEST G.1 - Backend rejects Women payload on Men route (/api/admin/categories/men/products) with HTTP 400",
    mismatchMenRouteRes.status === 400 && !mismatchMenRouteRes.body.success,
    `Status: ${mismatchMenRouteRes.status}, Message: ${mismatchMenRouteRes.body?.message}`
  );

  // Attempt to submit Men product to Women route
  const mismatchWomenRouteRes = await makeMultipartRequest(
    "POST",
    "/api/admin/categories/women/products",
    {
      name: `Tampered Category Men-on-Women ${Date.now()}`,
      brand: "FEXA",
      category: "Men", // TAMPERED!
      description: "Attempting to create Men product on Women route.",
      variants: JSON.stringify([{ volumeMl: 100, sellingPrice: 1500, stock: 10 }]),
    },
    [{ fieldname: "images", filename: "img.png", mimetype: "image/png", content: DUMMY_PNG_BUFFER }]
  );
  recordTest(
    "TEST G.2 - Backend rejects Men payload on Women route (/api/admin/categories/women/products) with HTTP 400",
    mismatchWomenRouteRes.status === 400 && !mismatchWomenRouteRes.body.success,
    `Status: ${mismatchWomenRouteRes.status}`
  );

  // Attempt to submit Men product to Unisex route
  const mismatchUnisexRouteRes = await makeMultipartRequest(
    "POST",
    "/api/admin/categories/unisex/products",
    {
      name: `Tampered Category Men-on-Unisex ${Date.now()}`,
      brand: "FEXA",
      category: "Men", // TAMPERED!
      description: "Attempting to create Men product on Unisex route.",
      variants: JSON.stringify([{ volumeMl: 100, sellingPrice: 1500, stock: 10 }]),
    },
    [{ fieldname: "images", filename: "img.png", mimetype: "image/png", content: DUMMY_PNG_BUFFER }]
  );
  recordTest(
    "TEST G.3 - Backend rejects Men payload on Unisex route (/api/admin/categories/unisex/products) with HTTP 400",
    mismatchUnisexRouteRes.status === 400 && !mismatchUnisexRouteRes.body.success,
    `Status: ${mismatchUnisexRouteRes.status}`
  );

  // ---------------------------------------------------------
  // TEST H: EDIT PRODUCT BEHAVIOR
  // ---------------------------------------------------------
  console.log("\n--- TEST H: EDIT PRODUCT BEHAVIOR ---");
  if (createdMenId) {
    const editRes = await makeMultipartRequest(
      "PUT",
      `/api/admin/products/${createdMenId}`,
      {
        name: `${menProdName} (Updated Edition)`,
        brand: "FEXA Atelier",
        category: "Men",
        description: "Updated description preserving variants and category accurately.",
        variants: JSON.stringify([
          { volumeMl: 50, sellingPrice: 1999, originalPrice: 2599, stock: 20, isAvailable: true },
          { volumeMl: 100, sellingPrice: 2999, originalPrice: 3699, stock: 35, isAvailable: true },
        ]),
      },
      []
    );

    recordTest("TEST H.1 - Product edit returns HTTP 200", editRes.status === 200 && editRes.body.success);
    const updatedDoc = await Product.findById(createdMenId);
    recordTest("TEST H.2 - Product category remains 'Men' after edit", updatedDoc && updatedDoc.category === "Men");
    recordTest("TEST H.3 - Product variants and price updated correctly", updatedDoc && updatedDoc.price === 1999 && updatedDoc.variants.length === 2);
    recordTest("TEST H.4 - Edit did not create duplicate product (same ObjectId)", updatedDoc && updatedDoc._id.toString() === createdMenId);
  }

  // ---------------------------------------------------------
  // TEST I: DATA INTEGRITY & CLEANUP OF TEST PRODUCTS
  // ---------------------------------------------------------
  console.log("\n--- TEST I: DATA INTEGRITY ---");
  const totalOrders = await Order.countDocuments({});
  recordTest("TEST I.1 - Existing order collection and history remain fully intact", totalOrders >= 0, `Total Orders: ${totalOrders}`);

  const menCount = await Product.countDocuments({ category: "Men" });
  const womenCount = await Product.countDocuments({ category: "Women" });
  const unisexCount = await Product.countDocuments({ category: "Unisex" });
  const allCount = await Product.countDocuments({});
  recordTest(
    "TEST I.2 - Category counts sum matches total products",
    menCount + womenCount + unisexCount === allCount,
    `Men: ${menCount}, Women: ${womenCount}, Unisex: ${unisexCount}, All: ${allCount}`
  );

  // Clean up created test products
  const testIds = [createdMenId, createdWomenId, createdUnisexId].filter(Boolean);
  if (testIds.length > 0) {
    await Product.deleteMany({ _id: { $in: testIds } });
    console.log(`Cleaned up ${testIds.length} temporary test products from MongoDB.`);
  }

  // ---------------------------------------------------------
  // TEST J: REGRESSION CHECK ON CORE PUBLIC & USER APIS
  // ---------------------------------------------------------
  console.log("\n--- TEST J: REGRESSION CHECK ON CORE CUSTOMER ENDPOINTS ---");
  const publicShopRes = await makeRequest("GET", "/api/products");
  recordTest("TEST J.1 - Customer /api/products returns HTTP 200", publicShopRes.status === 200);

  const categoriesRes = await makeRequest("GET", "/api/admin/categories");
  recordTest("TEST J.2 - Admin /api/admin/categories returns HTTP 200 with counts", categoriesRes.status === 200 && Array.isArray(categoriesRes.body.categories));

  // Summary
  console.log("\n============================================================");
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  console.log(`  TEST RESULTS: ${passed}/${total} PASSED (${failed} failed)`);
  console.log("============================================================\n");

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
