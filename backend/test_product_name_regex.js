/**
 * FEXA Product Name Regex Validation Test Suite
 * Tests all 10 cases required by the user prompt, plus full valid and invalid lists.
 */

import http from "http";
import mongoose from "mongoose";
import path from "path";
import { validateProductName } from "./validators/product.validator.js";
import Product from "./models/product.model.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/fexa-project";
const BASE_URL = "http://localhost:5000";

let adminCookie = "";
let results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓ PASS" : "✗ FAIL"} - ${name} ${detail ? `(${detail})` : ""}`);
}

function makeRequest(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers },
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

function makeMultipartRequest(method, urlPath, fields = {}, files = []) {
  return new Promise((resolve, reject) => {
    const boundary = "----FexaFormBoundary" + Math.random().toString(36).substring(2);
    const url = new URL(urlPath, BASE_URL);

    let buffers = [];

    for (const [key, val] of Object.entries(fields)) {
      buffers.push(Buffer.from(`--${boundary}\r\n`));
      buffers.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
      buffers.push(Buffer.from(`${val}\r\n`));
    }

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

const DUMMY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

async function run() {
  console.log("\n============================================================");
  console.log("  FEXA PRODUCT NAME REGEX VALIDATION TESTS");
  console.log("============================================================\n");

  await mongoose.connect(MONGO_URI);

  // Step 0: Admin Login
  const loginRes = await makeRequest("POST", "/api/admin/auth/login", {}, {
    email: "admin@fexa.com",
    password: "Admin12345@",
  });
  record("Admin Login", loginRes.status === 200);

  // ---------------------------------------------------------
  // UNIT TESTS: ALL 10 USER REQUIRED CASES
  // ---------------------------------------------------------
  console.log("\n--- SECTION 1: UNIT VALIDATION (ALL REQUIRED CASES) ---");

  // Case 1: Enter '12345' — reject
  const c1 = validateProductName("12345");
  record("Case 1: '12345' (numbers only) rejected", !!c1, c1);

  // Case 2: Enter '000' — reject
  const c2 = validateProductName("000");
  record("Case 2: '000' (numbers only) rejected", !!c2, c2);

  // Case 3: Enter 'Velvet Oud' — accept
  const c3 = validateProductName("Velvet Oud");
  record("Case 3: 'Velvet Oud' accepted", c3 === null);

  // Case 4: Enter '212 VIP' — accept
  const c4 = validateProductName("212 VIP");
  record("Case 4: '212 VIP' (letters + numbers) accepted", c4 === null);

  // Case 5: Enter 'FEXA 100' — accept
  const c5 = validateProductName("FEXA 100");
  record("Case 5: 'FEXA 100' (letters + numbers) accepted", c5 === null);

  // Case 6: Enter '!!!!!!' — reject
  const c6 = validateProductName("!!!!!!");
  record("Case 6: '!!!!!!' (symbols only) rejected", !!c6, c6);

  // Case 7: Enter spaces only — reject
  const c7 = validateProductName("     ");
  record("Case 7: spaces only rejected", !!c7, c7);

  // Case 8: Submit a valid name with leading or trailing spaces — trim and validate
  const c8 = validateProductName("   Sauvage Elixir   ");
  record("Case 8: '   Sauvage Elixir   ' trimmed and accepted", c8 === null);

  // Additional valid examples from prompt:
  const validExamples = [
    "Velvet Oud",
    "FEXA 100",
    "212 VIP",
    "Sauvage Elixir",
    "Rose-vanilla",
    "Oud & Amber",
    "Perfume 24",
    "Éclat Noir",
  ];
  for (const name of validExamples) {
    const err = validateProductName(name);
    record(`Valid example: '${name}' accepted`, err === null);
  }

  // Additional invalid examples from prompt:
  const invalidExamples = [
    "123456",
    "0000",
    "987654321",
    "!!!!!!!!",
    "///////",
    ".......",
    "______",
    "-------",
    "",
    "   ",
  ];
  for (const name of invalidExamples) {
    const err = validateProductName(name);
    record(`Invalid example: '${name}' rejected`, !!err, err);
  }

  // ---------------------------------------------------------
  // SECTION 2: BACKEND API CREATION WITH NUMERIC-ONLY (CASE 9)
  // ---------------------------------------------------------
  console.log("\n--- SECTION 2: BACKEND API CREATION (CASE 9) ---");

  // Case 9: Send a numeric-only name directly to the backend API — reject
  const createNumericRes = await makeMultipartRequest(
    "POST",
    "/api/admin/categories/men/products",
    {
      name: "999888777",
      brand: "FEXA",
      category: "Men",
      description: "Direct API test with numeric-only product name.",
      variants: JSON.stringify([{ volumeMl: 100, sellingPrice: 1500, stock: 10 }]),
    },
    [{ fieldname: "images", filename: "sample.png", mimetype: "image/png", content: DUMMY_PNG }]
  );

  record(
    "Case 9: Backend rejects numeric-only product name on creation with HTTP 400",
    createNumericRes.status === 400 && !createNumericRes.body.success,
    `Status: ${createNumericRes.status}, Error: ${JSON.stringify(createNumericRes.body?.errors || createNumericRes.body?.message)}`
  );

  // Also verify symbol-only directly on API
  const createSymbolRes = await makeMultipartRequest(
    "POST",
    "/api/admin/categories/men/products",
    {
      name: "-------",
      brand: "FEXA",
      category: "Men",
      description: "Direct API test with symbol-only product name.",
      variants: JSON.stringify([{ volumeMl: 100, sellingPrice: 1500, stock: 10 }]),
    },
    [{ fieldname: "images", filename: "sample.png", mimetype: "image/png", content: DUMMY_PNG }]
  );
  record(
    "Backend rejects symbol-only product name on creation with HTTP 400",
    createSymbolRes.status === 400 && !createSymbolRes.body.success,
    `Status: ${createSymbolRes.status}`
  );

  // ---------------------------------------------------------
  // SECTION 3: BACKEND API UPDATE WITH NUMERIC-ONLY (CASE 10)
  // ---------------------------------------------------------
  console.log("\n--- SECTION 3: BACKEND API UPDATE (CASE 10) ---");

  // Create a valid temporary product first
  const validCreateRes = await makeMultipartRequest(
    "POST",
    "/api/admin/categories/men/products",
    {
      name: `Temp Product For Update Test ${Date.now()}`,
      brand: "FEXA",
      category: "Men",
      description: "Temporary product created to test update validation.",
      variants: JSON.stringify([{ volumeMl: 100, sellingPrice: 1500, stock: 10 }]),
    },
    [{ fieldname: "images", filename: "sample.png", mimetype: "image/png", content: DUMMY_PNG }]
  );

  const testProdId = validCreateRes.body?.product?._id;
  record("Setup: Temporary product created successfully", validCreateRes.status === 201 && !!testProdId);

  if (testProdId) {
    // Case 10: Update an existing product using a numeric-only name — reject
    const updateNumericRes = await makeMultipartRequest(
      "PUT",
      `/api/admin/products/${testProdId}`,
      {
        name: "12345", // NUMERIC ONLY!
        brand: "FEXA",
        category: "Men",
        description: "Attempting to update with numeric only name.",
        variants: JSON.stringify([{ volumeMl: 100, sellingPrice: 1500, stock: 10 }]),
      },
      []
    );

    record(
      "Case 10: Backend rejects numeric-only product name on update with HTTP 400",
      updateNumericRes.status === 400 && !updateNumericRes.body.success,
      `Status: ${updateNumericRes.status}, Error: ${JSON.stringify(updateNumericRes.body?.errors || updateNumericRes.body?.message)}`
    );

    // Verify product name was NOT changed in MongoDB
    const docAfterFailedUpdate = await Product.findById(testProdId);
    record(
      "Database integrity: Product name remained unchanged in MongoDB after failed numeric update",
      docAfterFailedUpdate && docAfterFailedUpdate.name.startsWith("Temp Product For Update Test")
    );

    // Update with a valid name containing letters and numbers (e.g. '212 VIP')
    const updateValidRes = await makeMultipartRequest(
      "PUT",
      `/api/admin/products/${testProdId}`,
      {
        name: `212 VIP Special Edition ${Date.now()}`,
        brand: "FEXA",
        category: "Men",
        description: "Valid update with letters and numbers.",
        variants: JSON.stringify([{ volumeMl: 100, sellingPrice: 1600, stock: 10 }]),
      },
      []
    );
    record(
      "Backend accepts valid update with letters and numbers",
      updateValidRes.status === 200 && updateValidRes.body.success
    );

    // Cleanup
    await Product.findByIdAndDelete(testProdId);
    console.log("Cleaned up temporary test product.");
  }

  // ---------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------
  console.log("\n============================================================");
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`  RESULTS: ${passed}/${total} PASSED (${failed} failed)`);
  console.log("============================================================\n");

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
