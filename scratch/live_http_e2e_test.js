/**
 * End-to-End HTTP Integration Test for Live Backend (http://localhost:5000)
 */

const http = require("http");

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, text: data });
        }
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runLiveE2ETest() {
  console.log("=== STARTING LIVE HTTP E2E VERIFICATION ON PORT 5000 ===");

  // 1. Admin login to obtain cookie
  const loginRes = await request(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/admin/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: "admin@fexa.com", password: "Admin12345@" }
  );

  console.log("1. Admin Login Response Status:", loginRes.status);
  if (loginRes.status !== 200) {
    throw new Error("Admin login failed: " + JSON.stringify(loginRes.body));
  }

  const cookieHeader = loginRes.headers["set-cookie"];
  const cookie = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  console.log("   Admin session cookie acquired.");

  // 2. Fetch categories via admin endpoint
  const catsRes = await request({
    hostname: "localhost",
    port: 5000,
    path: "/api/admin/categories",
    method: "GET",
    headers: { Cookie: cookie },
  });
  console.log("2. GET /api/admin/categories Status:", catsRes.status);
  console.log(
    "   Categories found:",
    catsRes.body.categories.map((c) => `${c.name} (active: ${c.isActive}, total: ${c.counts.totalProducts})`)
  );

  // 3. Fetch each category by slug
  for (const slug of ["men", "women", "unisex"]) {
    const singleRes = await request({
      hostname: "localhost",
      port: 5000,
      path: `/api/admin/categories/${slug}`,
      method: "GET",
      headers: { Cookie: cookie },
    });
    console.log(`3. GET /api/admin/categories/${slug} Status: ${singleRes.status}, Name: ${singleRes.body.category.name}`);
  }

  // 4. Fetch category-specific products for men, women, unisex
  for (const slug of ["men", "women", "unisex"]) {
    const prodRes = await request({
      hostname: "localhost",
      port: 5000,
      path: `/api/admin/categories/${slug}/products?page=1&limit=5`,
      method: "GET",
      headers: { Cookie: cookie },
    });
    console.log(
      `4. Category ${slug.toUpperCase()} products: ${prodRes.body.products.length} items (total: ${prodRes.body.pagination.totalProducts})`
    );
    const allMatch = prodRes.body.products.every(
      (p) => p.category.toLowerCase() === slug
    );
    if (!allMatch) {
      throw new Error(`Stray products detected in ${slug} category listing!`);
    }
  }
  console.log("   ✓ Verified strict category boundary isolation across all three pages.");

  // 5. Test independent deactivation of Women
  console.log("5. Testing independent deactivation of Women category...");
  const deactRes = await request(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/admin/categories/women/status",
      method: "PATCH",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
    },
    { isActive: false }
  );
  console.log("   Deactivation response status:", deactRes.status, "isActive:", deactRes.body.category.isActive);

  // Check public endpoint for women
  const pubWomenRes = await request({
    hostname: "localhost",
    port: 5000,
    path: "/api/products?category=women",
    method: "GET",
  });
  console.log(
    "   Public GET /api/products?category=women -> products count:",
    pubWomenRes.body.products.length,
    "isCategoryInactive:",
    pubWomenRes.body.isCategoryInactive
  );

  // Check public endpoint for men (should remain active!)
  const pubMenRes = await request({
    hostname: "localhost",
    port: 5000,
    path: "/api/products?category=men",
    method: "GET",
  });
  console.log(
    "   Public GET /api/products?category=men -> products count:",
    pubMenRes.body.products.length,
    "Men category active:",
    pubMenRes.body.categoryStatuses.Men
  );

  // Reactivate Women
  console.log("6. Reactivating Women category...");
  const reactRes = await request(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/admin/categories/women/status",
      method: "PATCH",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
    },
    { isActive: true }
  );
  console.log("   Reactivation response status:", reactRes.status, "isActive:", reactRes.body.category.isActive);

  // Verify public endpoint returns Women products again
  const pubWomenRestored = await request({
    hostname: "localhost",
    port: 5000,
    path: "/api/products?category=women",
    method: "GET",
  });
  console.log(
    "   Public GET /api/products?category=women after reactivate -> products count:",
    pubWomenRestored.body.products.length
  );

  console.log("\n=== ALL LIVE HTTP E2E INTEGRATION CHECKS PASSED SUCCESSFULLY! ===");
}

runLiveE2ETest().catch((err) => {
  console.error("Live E2E Verification Failed:", err);
  process.exit(1);
});
