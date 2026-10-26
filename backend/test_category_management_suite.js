/**
 * Comprehensive Automated Test Suite for FEXA Category Management
 * Tests A through K based on Prompt Specifications
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Category from "./models/category.model.js";
import Product from "./models/product.model.js";
import Order from "./models/order.model.js";
import User from "./models/user.model.js";
import Cart from "./models/cart.model.js";
import seedCategories from "./config/seedCategories.js";
import {
  getCategories,
  getCategoryBySlug,
  toggleCategoryStatus,
  getCategoryProducts,
} from "./controllers/adminCategory.controller.js";
import {
  getPublicProducts,
  getPublicProductCollections,
  getPublicProductById,
} from "./controllers/product.controller.js";
import { addToCart, formatCartResponse } from "./controllers/cart.controller.js";
import { createOrder } from "./controllers/order.controller.js";
import { addToWishlist, moveToCart } from "./controllers/wishlist.controller.js";
import adminMiddleware from "./middlewares/admin.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

let passed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (!condition) {
    console.error(`❌ FAIL: ${testName}`);
    throw new Error(`Assertion failed: ${testName}`);
  } else {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  }
}

async function runTestSuite() {
  console.log("==================================================");
  console.log("FEXA CATEGORY MANAGEMENT TEST SUITE (TESTS A - K)");
  console.log("==================================================\n");

  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/fexa-project";
  await mongoose.connect(mongoUri);

  // Ensure categories are initialized
  await seedCategories();

  // 1. SETUP: Create test admin and user if needed
  let testAdmin = await User.findOne({ role: "admin" });
  if (!testAdmin) {
    testAdmin = await User.create({
      name: "Test Admin",
      email: "testadmin@fexa.com",
      password: "hashedpassword",
      role: "admin",
      authProvider: "local",
      emailVerified: true,
    });
  }

  let testUser = await User.findOne({ role: "user" });
  if (!testUser) {
    testUser = await User.create({
      name: "Test User",
      email: "testuser@fexa.com",
      password: "hashedpassword",
      role: "user",
      authProvider: "local",
      emailVerified: true,
    });
  }

  const adminToken = jwt.sign(
    { id: testAdmin._id, role: "admin" },
    process.env.JWT_SECRET || "fexa_super_secret_key_2026_change_this"
  );
  const userToken = jwt.sign(
    { id: testUser._id, role: "user" },
    process.env.JWT_SECRET || "fexa_super_secret_key_2026_change_this"
  );

  // Helper mock res
  const createMockRes = () => {
    return {
      statusCode: 200,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      },
    };
  };

  // ==============================================================
  // TEST A: Category Configuration Model & Endpoints
  // ==============================================================
  console.log("--- TEST A: CATEGORY MODEL & ROUTING ---");
  const allCategories = await Category.find({});
  assert(allCategories.length === 3, "TEST A: Exactly 3 category documents exist (Men, Women, Unisex)");
  const names = allCategories.map((c) => c.name).sort();
  assert(
    JSON.stringify(names) === JSON.stringify(["Men", "Unisex", "Women"]),
    "TEST A: All three distinct categories Men, Women, Unisex exist"
  );

  // Test admin getCategories
  const mockResA = createMockRes();
  await getCategories({}, mockResA);
  assert(mockResA.statusCode === 200, "TEST A: getCategories returns 200");
  assert(mockResA.jsonData.categories.length === 3, "TEST A: getCategories returns 3 categories");
  assert(
    mockResA.jsonData.categories.every((c) => c.counts && typeof c.counts.totalProducts === "number"),
    "TEST A: getCategories returns real counts for each category"
  );

  // Test getCategoryBySlug for men, women, unisex
  for (const slug of ["men", "women", "unisex"]) {
    const mockResSlug = createMockRes();
    await getCategoryBySlug({ params: { slug } }, mockResSlug);
    assert(mockResSlug.statusCode === 200, `TEST A: getCategoryBySlug returns 200 for ${slug}`);
    assert(mockResSlug.jsonData.category.slug === slug, `TEST A: Category slug matches ${slug}`);
  }

  // ==============================================================
  // TEST B: SEPARATE PRODUCT LISTS PER CATEGORY
  // ==============================================================
  console.log("\n--- TEST B: SEPARATE PRODUCT LISTS PER CATEGORY ---");
  for (const catName of ["Men", "Women", "Unisex"]) {
    const mockResCatProds = createMockRes();
    await getCategoryProducts(
      { params: { slug: catName.toLowerCase() }, query: { page: 1, limit: 10 } },
      mockResCatProds
    );
    assert(mockResCatProds.statusCode === 200, `TEST B: getCategoryProducts returns 200 for ${catName}`);
    const prods = mockResCatProds.jsonData.products;
    assert(
      prods.every((p) => p.category === catName),
      `TEST B: Category ${catName} contains strictly ${catName} products`
    );
  }

  // ==============================================================
  // TEST C: INDEPENDENT DEACTIVATION OF ONE CATEGORY (Women)
  // ==============================================================
  console.log("\n--- TEST C: INDEPENDENT CATEGORY DEACTIVATION ---");
  // Ensure all are currently active
  await Category.updateMany({}, { isActive: true });

  // Record individual Women product statuses before category deactivation
  const womenProdsBefore = await Product.find({ category: "Women" });
  const statusesBefore = womenProdsBefore.map((p) => ({ id: p._id.toString(), status: p.status }));

  // Deactivate Women category
  const mockResToggle = createMockRes();
  await toggleCategoryStatus({ params: { slug: "women" }, body: { isActive: false } }, mockResToggle);
  assert(mockResToggle.statusCode === 200, "TEST C: toggleCategoryStatus returns 200 for Women");
  assert(mockResToggle.jsonData.category.isActive === false, "TEST C: Women category is now inactive in DB");

  // Verify Men and Unisex are completely unaffected!
  const menCat = await Category.findOne({ slug: "men" });
  const unisexCat = await Category.findOne({ slug: "unisex" });
  const womenCat = await Category.findOne({ slug: "women" });
  assert(womenCat.isActive === false, "TEST C: Women is inactive");
  assert(menCat.isActive === true, "TEST C: Men remains active");
  assert(unisexCat.isActive === true, "TEST C: Unisex remains active");

  // Verify product-level statuses in MongoDB remain 100% UNCHANGED!
  const womenProdsAfter = await Product.find({ category: "Women" });
  assert(womenProdsAfter.length === womenProdsBefore.length, "TEST C: Women products count in MongoDB unchanged");
  const statusesAfter = womenProdsAfter.map((p) => ({ id: p._id.toString(), status: p.status }));
  assert(
    JSON.stringify(statusesBefore) === JSON.stringify(statusesAfter),
    "TEST C: Individual product statuses in MongoDB remain completely untouched"
  );

  // ==============================================================
  // TEST D: CUSTOMER-FACING VISIBILITY & PURCHASE RESTRICTIONS
  // ==============================================================
  console.log("\n--- TEST D: CUSTOMER VISIBILITY & PURCHASE RESTRICTIONS ---");

  // 1. Public products with category=women returns 0 products and isCategoryInactive: true
  const mockResPubWomen = createMockRes();
  await getPublicProducts({ query: { category: "women" } }, mockResPubWomen);
  assert(mockResPubWomen.statusCode === 200, "TEST D: getPublicProducts returns 200");
  assert(mockResPubWomen.jsonData.products.length === 0, "TEST D: Inactive Women category returns 0 public products");
  assert(mockResPubWomen.jsonData.isCategoryInactive === true, "TEST D: Response flags isCategoryInactive: true");

  // 2. General public products listing does NOT contain any Women products
  const mockResPubAll = createMockRes();
  await getPublicProducts({ query: { category: "all" } }, mockResPubAll);
  assert(mockResPubAll.statusCode === 200, "TEST D: getPublicProducts all returns 200");
  const allPubProds = mockResPubAll.jsonData.products;
  assert(
    allPubProds.every((p) => p.category !== "Women"),
    "TEST D: General catalogue contains NO products from inactive Women category"
  );
  assert(
    allPubProds.some((p) => p.category === "Men"),
    "TEST D: Active Men products still appear in general catalogue"
  );

  // 3. Public search does NOT return Women products even if search query matches Women product name
  const sampleWomenProd = womenProdsAfter[0];
  const mockResSearch = createMockRes();
  await getPublicProducts({ query: { search: sampleWomenProd.name } }, mockResSearch);
  assert(
    mockResSearch.jsonData.products.every((p) => p.category !== "Women"),
    "TEST D: Public search strictly excludes products from inactive Women category"
  );

  // 4. Public collections summary reflects Women as inactive with 0 count
  const mockResCollections = createMockRes();
  await getPublicProductCollections({}, mockResCollections);
  const collData = mockResCollections.jsonData.collections;
  assert(collData.women.isActive === false, "TEST D: Public collections marks Women isActive: false");
  assert(collData.women.count === 0, "TEST D: Public collections returns 0 count for Women");
  assert(collData.men.isActive === true, "TEST D: Public collections marks Men isActive: true");
  assert(collData.men.count > 0, "TEST D: Public collections returns active count for Men");

  // 5. Direct product details route returns 400 unavailable for Women product
  const mockResDetail = createMockRes();
  await getPublicProductById({ params: { id: sampleWomenProd._id.toString() } }, mockResDetail);
  assert(mockResDetail.statusCode === 400, "TEST D: Direct product details returns 400 for inactive category");
  assert(mockResDetail.jsonData.isCategoryInactive === true, "TEST D: Product details flags isCategoryInactive: true");

  // 6. Adding to cart via API is rejected for Women product
  const mockResCartAdd = createMockRes();
  await addToCart(
    {
      user: { id: testUser._id },
      body: { productId: sampleWomenProd._id.toString(), quantity: 1 },
    },
    mockResCartAdd
  );
  assert(mockResCartAdd.statusCode === 400, "TEST D: Adding inactive category product to cart is rejected with 400");
  assert(
    mockResCartAdd.jsonData.message.includes("Women collection is currently unavailable"),
    "TEST D: Meaningful error message returned on cart add"
  );

  // 7. Cart calculation marks existing cart item from inactive category as inactive/unavailable
  let userCart = await Cart.findOne({ user: testUser._id });
  if (!userCart) {
    userCart = await Cart.create({ user: testUser._id, items: [] });
  }
  userCart.items = [
    {
      product: sampleWomenProd._id,
      volumeMl: 100,
      quantity: 1,
    },
  ];
  await userCart.save();

  const formattedCart = await formatCartResponse(userCart);
  assert(formattedCart.items[0].isInactive === true, "TEST D: Existing cart item from inactive category is marked isInactive: true");
  assert(formattedCart.subtotal === 0, "TEST D: Inactive category item excluded from cart subtotal");

  // 8. Order creation is rejected if cart contains an item from inactive category
  const mockResOrder = createMockRes();
  await createOrder(
    {
      user: { id: testUser._id },
      body: {
        paymentMethod: "COD",
        items: [
          {
            product: sampleWomenProd._id,
            productId: sampleWomenProd._id,
            volumeMl: 100,
            quantity: 1,
          },
        ],
      },
    },
    mockResOrder
  );
  assert(mockResOrder.statusCode === 400, "TEST D: Order creation with inactive category product is rejected with 400");

  // 9. Wishlist: adding or moving to cart rejected for inactive category
  const mockResWishAdd = createMockRes();
  await addToWishlist(
    {
      user: { id: testUser._id },
      body: { productId: sampleWomenProd._id.toString() },
    },
    mockResWishAdd
  );
  assert(mockResWishAdd.statusCode === 400, "TEST D: Adding inactive category product to wishlist is rejected with 400");

  const mockResWishMove = createMockRes();
  await moveToCart(
    {
      user: { id: testUser._id },
      body: { productId: sampleWomenProd._id.toString() },
    },
    mockResWishMove
  );
  assert(mockResWishMove.statusCode === 400, "TEST D: Moving inactive category product from wishlist to cart rejected with 400");

  // ==============================================================
  // TEST E: RESTORE CATEGORY (Reactivate Women)
  // ==============================================================
  console.log("\n--- TEST E: RESTORE CATEGORY ---");
  const mockResReactivate = createMockRes();
  await toggleCategoryStatus({ params: { slug: "women" }, body: { isActive: true } }, mockResReactivate);
  assert(mockResReactivate.statusCode === 200, "TEST E: Reactivating Women returns 200");
  assert(mockResReactivate.jsonData.category.isActive === true, "TEST E: Women category is now active");

  // Verify Women products appear again publicly
  const mockResPubWomenActive = createMockRes();
  await getPublicProducts({ query: { category: "women" } }, mockResPubWomenActive);
  assert(
    mockResPubWomenActive.jsonData.products.length > 0,
    "TEST E: Reactivated Women products now appear in public collections"
  );

  // Individually inactive products remain inactive!
  const inactiveWomenProd = await Product.findOne({ category: "Women", status: "Inactive" });
  if (inactiveWomenProd) {
    const mockResInactiveDetail = createMockRes();
    await getPublicProductById({ params: { id: inactiveWomenProd._id.toString() } }, mockResInactiveDetail);
    assert(mockResInactiveDetail.statusCode === 400, "TEST E: Individually inactive Women product remains unavailable");
  }

  // ==============================================================
  // TEST F: INDEPENDENCE OF OTHER CATEGORIES
  // ==============================================================
  console.log("\n--- TEST F: INDEPENDENCE OF MEN & UNISEX CATEGORIES ---");
  // Deactivate Men
  await toggleCategoryStatus({ params: { slug: "men" }, body: { isActive: false } }, createMockRes());
  const menCheck = await Category.findOne({ slug: "men" });
  const womenCheck = await Category.findOne({ slug: "women" });
  const unisexCheck = await Category.findOne({ slug: "unisex" });
  assert(menCheck.isActive === false, "TEST F: Men is inactive");
  assert(womenCheck.isActive === true, "TEST F: Women remains active when Men is deactivated");
  assert(unisexCheck.isActive === true, "TEST F: Unisex remains active when Men is deactivated");

  // Reactivate Men
  await toggleCategoryStatus({ params: { slug: "men" }, body: { isActive: true } }, createMockRes());

  // Deactivate Unisex
  await toggleCategoryStatus({ params: { slug: "unisex" }, body: { isActive: false } }, createMockRes());
  const menCheck2 = await Category.findOne({ slug: "men" });
  const womenCheck2 = await Category.findOne({ slug: "women" });
  const unisexCheck2 = await Category.findOne({ slug: "unisex" });
  assert(unisexCheck2.isActive === false, "TEST F: Unisex is inactive");
  assert(menCheck2.isActive === true, "TEST F: Men remains active when Unisex is deactivated");
  assert(womenCheck2.isActive === true, "TEST F: Women remains active when Unisex is deactivated");

  // Reactivate Unisex
  await toggleCategoryStatus({ params: { slug: "unisex" }, body: { isActive: true } }, createMockRes());

  // ==============================================================
  // TEST G: PRODUCT MANAGEMENT (CRUD per Category)
  // ==============================================================
  console.log("\n--- TEST G: PRODUCT CRUD PER CATEGORY ---");
  const testFragrance = new Product({
    name: `Test Men Special Edition ${Date.now()}`,
    slug: `test-men-special-${Date.now()}`,
    brand: "FEXA",
    category: "Men",
    price: 3400,
    stock: 12,
    description: "Exclusive patchouli and smoked cedar fragrance.",
    status: "Active",
    images: ["/uploads/products/test-men.jpg"],
    variants: [
      {
        volumeMl: 100,
        sellingPrice: 3400,
        originalPrice: 4000,
        stock: 12,
        isAvailable: true,
      },
    ],
  });
  await testFragrance.save();

  // Verify it appears in Men category products
  const mockResMenList = createMockRes();
  await getCategoryProducts({ params: { slug: "men" }, query: { search: testFragrance.name } }, mockResMenList);
  assert(
    mockResMenList.jsonData.products.some((p) => p._id.toString() === testFragrance._id.toString()),
    "TEST G: Newly created Men product appears in Men Category Management"
  );

  // Verify it does NOT appear in Women or Unisex category products
  const mockResWomenList = createMockRes();
  await getCategoryProducts({ params: { slug: "women" }, query: { search: testFragrance.name } }, mockResWomenList);
  assert(
    !mockResWomenList.jsonData.products.some((p) => p._id.toString() === testFragrance._id.toString()),
    "TEST G: Men product does NOT appear in Women Category Management"
  );

  // Clean up test product
  await Product.findByIdAndDelete(testFragrance._id);

  // ==============================================================
  // TEST H: SEARCH AND PAGINATION WITHIN CATEGORY
  // ==============================================================
  console.log("\n--- TEST H: CATEGORY-SCOPED SEARCH & PAGINATION ---");
  const mockResSearchCat = createMockRes();
  await getCategoryProducts(
    { params: { slug: "men" }, query: { search: "FEXA", page: 1, limit: 2 } },
    mockResSearchCat
  );
  assert(mockResSearchCat.statusCode === 200, "TEST H: Scoped search returns 200");
  assert(
    mockResSearchCat.jsonData.products.every((p) => p.category === "Men"),
    "TEST H: Scoped search in Men strictly returns only Men products"
  );
  assert(
    mockResSearchCat.jsonData.pagination.limit === 2,
    "TEST H: Pagination limit respected within category"
  );

  // ==============================================================
  // TEST I: HISTORICAL ORDERS PRESERVED ON CATEGORY DEACTIVATION
  // ==============================================================
  console.log("\n--- TEST I: HISTORICAL ORDERS INTEGRITY ---");
  const ordersCountBefore = await Order.countDocuments({});
  // Deactivate Men
  await toggleCategoryStatus({ params: { slug: "men" }, body: { isActive: false } }, createMockRes());

  const ordersCountAfter = await Order.countDocuments({});
  assert(ordersCountAfter === ordersCountBefore, "TEST I: Historical orders count completely intact in MongoDB");

  // Check any existing order snapshots
  const sampleOrder = await Order.findOne({ "items.category": "Men" });
  if (sampleOrder) {
    assert(sampleOrder.items.length > 0, "TEST I: Order items snapshot intact");
    assert(sampleOrder.totalAmount > 0, "TEST I: Historical order total amount intact");
  }

  // Restore Men
  await toggleCategoryStatus({ params: { slug: "men" }, body: { isActive: true } }, createMockRes());

  // ==============================================================
  // TEST J: SECURITY - ADMIN AUTHORIZATION
  // ==============================================================
  console.log("\n--- TEST J: SECURITY & AUTHORIZATION ---");

  // Call adminMiddleware without token
  let authFailed = false;
  const mockReqNoAuth = { cookies: {}, headers: {} };
  const mockResNoAuth = {
    status(code) {
      if (code === 401) authFailed = true;
      return this;
    },
    json(data) {
      return this;
    },
  };
  await adminMiddleware(mockReqNoAuth, mockResNoAuth, () => {});
  assert(authFailed === true, "TEST J: Request without admin token rejected with 401");

  // Call adminMiddleware with user token (role: 'user')
  let roleForbidden = false;
  const mockReqUser = {
    cookies: {},
    headers: { authorization: `Bearer ${userToken}` },
  };
  const mockResUser = {
    status(code) {
      if (code === 403) roleForbidden = true;
      return this;
    },
    json(data) {
      return this;
    },
  };
  await adminMiddleware(mockReqUser, mockResUser, () => {});
  assert(roleForbidden === true, "TEST J: Customer token denied admin category access with 403");

  // Clean up user's test cart
  await Cart.deleteOne({ user: testUser._id });

  console.log("\n==================================================");
  console.log(`ALL TESTS PASSED: ${passed}/${total} assertions successful!`);
  console.log("==================================================");

  await mongoose.disconnect();
}

runTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
