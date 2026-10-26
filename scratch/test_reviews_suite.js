import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
const require = createRequire(import.meta.url);
const mongoose = require("../backend/node_modules/mongoose");
const jwt = require("../backend/node_modules/jsonwebtoken");
const dotenv = require("../backend/node_modules/dotenv");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../backend/.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/fexa-project";
const JWT_SECRET = process.env.JWT_SECRET || "fexa_jwt_secret_key_2026";
const API_URL = "http://localhost:5000";

// Import models
import Product from "../backend/models/product.model.js";
import User from "../backend/models/user.model.js";
import Review from "../backend/models/review.model.js";

async function runTestSuite() {
  console.log("=== STARTING FEXA PRODUCT REVIEW & RATING TEST SUITE ===");
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB for test fixtures.");

  try {
    // 1. Setup Test Fixtures: Find or create a test product and test user
    let testProduct = await Product.findOne({ isDeleted: false, isActive: true });
    if (!testProduct) {
      testProduct = await Product.create({
        name: "Test Atelier Fragrance " + Date.now(),
        brand: "FEXA Test",
        category: "Men",
        price: 4500,
        description: "Test fragrance for review test suite.",
        stock: 20,
        images: ["/uploads/test.jpg"],
        variants: [{ volumeMl: 100, originalPrice: 5000, sellingPrice: 4500, stock: 20, isAvailable: true }],
      });
      console.log("Created test product:", testProduct._id);
    } else {
      console.log("Using existing test product:", testProduct.name, testProduct._id);
    }

    let testUser = await User.findOne({ role: "user" });
    if (!testUser) {
      testUser = await User.create({
        name: "Test Reviewer",
        email: `reviewer_${Date.now()}@fexa.test`,
        password: "hashedPassword123",
        role: "user",
      });
      console.log("Created test user:", testUser._id);
    } else {
      console.log("Using existing test user:", testUser.name, testUser._id);
    }

    let adminUser = await User.findOne({ role: "admin" });
    if (!adminUser) {
      adminUser = await User.create({
        name: "Admin Reviewer",
        email: `admin_${Date.now()}@fexa.test`,
        password: "hashedPassword123",
        role: "admin",
      });
      console.log("Created test admin:", adminUser._id);
    } else {
      console.log("Using existing admin user:", adminUser.name, adminUser._id);
    }

    // Generate tokens
    const userToken = jwt.sign({ id: testUser._id, role: testUser.role }, JWT_SECRET, { expiresIn: "1h" });
    const adminToken = jwt.sign({ id: adminUser._id, role: adminUser.role }, JWT_SECRET, { expiresIn: "1h" });

    // Clean up any existing review for this testUser and testProduct
    await Review.deleteMany({ product: testProduct._id, user: testUser._id });

    // ── TEST 1: User Submits a Review (Must default to status "pending") ──
    console.log("\n[TEST 1] User submits review for product...");
    const submitRes = await fetch(`${API_URL}/api/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        productId: testProduct._id,
        rating: 5,
        title: "Spectacular Sillage and Depth",
        comment: "This flacon exceeded every expectation. Longevity on skin was over 12 hours with incredible amber and cedarwood drydown.",
      }),
    });

    const submitText = await submitRes.text();
    let submitData;
    try {
      submitData = JSON.parse(submitText);
    } catch {
      throw new Error(`Submit responded with non-JSON (Status ${submitRes.status}): ${submitText.slice(0, 300)}`);
    }

    console.log("Submit Response Status:", submitRes.status);
    console.log("Submit Response Message:", submitData.message);
    if (!submitRes.ok || !submitData.success) {
      throw new Error(`Submit failed: ${JSON.stringify(submitData)}`);
    }

    const createdReview = await Review.findById(submitData.review._id);
    if (!createdReview) throw new Error("Review not found in database!");
    if (createdReview.status !== "pending") {
      throw new Error(`Expected status to be 'pending', but got '${createdReview.status}'!`);
    }
    console.log("✓ TEST 1 PASSED: Review saved with default status 'pending'.");

    // ── TEST 2: Public API should NOT show pending review ──
    console.log("\n[TEST 2] Verifying public product reviews excludes pending reviews...");
    const publicRes = await fetch(`${API_URL}/api/reviews/product/${testProduct._id}`);
    const publicData = await publicRes.json();
    console.log("Public reviews count:", publicData.reviews?.length || 0);
    const foundPendingInPublic = (publicData.reviews || []).some((r) => r._id.toString() === createdReview._id.toString());
    if (foundPendingInPublic) {
      throw new Error("FAIL: Pending review is visible to public!");
    }
    console.log("✓ TEST 2 PASSED: Pending review is not visible to general public.");

    // ── TEST 3: Admin Review Listing & Stats ──
    console.log("\n[TEST 3] Admin fetching all reviews and KPI stats...");
    const adminListRes = await fetch(`${API_URL}/api/admin/reviews?search=${encodeURIComponent(testProduct.name)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminListData = await adminListRes.json();
    console.log("Admin API status:", adminListRes.status);
    console.log("Admin total reviews returned:", adminListData.pagination?.totalReviews);
    console.log("Admin KPI metrics:", adminListData.metrics);
    if (!adminListRes.ok || !adminListData.success) {
      throw new Error(`Admin listing failed: ${JSON.stringify(adminListData)}`);
    }
    const adminFound = adminListData.reviews.some((r) => r._id.toString() === createdReview._id.toString());
    if (!adminFound) {
      throw new Error("Admin search could not find the newly created review!");
    }
    console.log("✓ TEST 3 PASSED: Admin retrieved review and KPI metrics.");

    // ── TEST 4: Admin Approves the Review ──
    console.log("\n[TEST 4] Admin approving the review...");
    const approveRes = await fetch(`${API_URL}/api/admin/reviews/${createdReview._id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "approved" }),
    });
    const approveData = await approveRes.json();
    console.log("Approve Response Status:", approveRes.status);
    if (!approveRes.ok || !approveData.success) {
      throw new Error(`Approve failed: ${JSON.stringify(approveData)}`);
    }
    console.log("✓ TEST 4 PASSED: Review approved by admin.");

    // ── TEST 5: Public API Now Reflects Approved Review and Rating Summary ──
    console.log("\n[TEST 5] Checking public product reviews after approval...");
    const publicResAfter = await fetch(`${API_URL}/api/reviews/product/${testProduct._id}`);
    const publicDataAfter = await publicResAfter.json();
    const approvedInPublic = (publicDataAfter.reviews || []).find((r) => r._id.toString() === createdReview._id.toString());
    if (!approvedInPublic) {
      throw new Error("Approved review did not appear in public reviews list!");
    }
    console.log("Public rating summary:", publicDataAfter.ratingSummary);
    if (publicDataAfter.ratingSummary.averageRating < 1 || publicDataAfter.ratingSummary.totalReviews < 1) {
      throw new Error("Rating summary does not accurately reflect the approved review!");
    }
    console.log("✓ TEST 5 PASSED: Approved review is public with updated ratingSummary.");

    // ── TEST 6: User Editing Own Review (Re-moderation to pending) ──
    console.log("\n[TEST 6] User updates their review...");
    const updateRes = await fetch(`${API_URL}/api/reviews/${createdReview._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        rating: 4,
        title: "Updated: Excellent flacon, subtle nuances",
        comment: "After wearing for a week, the sandalwood notes really develop beautifully. Solid 4 stars.",
      }),
    });
    const updateData = await updateRes.json();
    if (!updateRes.ok || !updateData.success) {
      throw new Error(`Update failed: ${JSON.stringify(updateData)}`);
    }
    const updatedReviewInDb = await Review.findById(createdReview._id);
    if (updatedReviewInDb.rating !== 4) {
      throw new Error("Rating was not updated to 4!");
    }
    if (updatedReviewInDb.status !== "pending") {
      throw new Error("Updated review should re-queue for moderation with status 'pending'!");
    }
    console.log("✓ TEST 6 PASSED: Review updated and safely re-queued as 'pending'.");

    // ── TEST 7: Duplicate Review Prevention ──
    console.log("\n[TEST 7] Testing duplicate review prevention...");
    const duplicateSubmitRes = await fetch(`${API_URL}/api/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        productId: testProduct._id,
        rating: 5,
        title: "Second review attempt",
        comment: "Attempting to create a second review for the same product.",
      }),
    });
    const dupData = await duplicateSubmitRes.json();
    const totalReviewsForUserProduct = await Review.countDocuments({ product: testProduct._id, user: testUser._id });
    if (totalReviewsForUserProduct !== 1) {
      throw new Error(`Expected exactly 1 review document for user+product, found: ${totalReviewsForUserProduct}`);
    }
    console.log("✓ TEST 7 PASSED: Duplicate review prevented; exactly 1 review document retained.");

    // ── TEST 8: Admin Deletes Review ──
    console.log("\n[TEST 8] Admin deletes review...");
    const deleteRes = await fetch(`${API_URL}/api/admin/reviews/${createdReview._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deleteData = await deleteRes.json();
    if (!deleteRes.ok || !deleteData.success) {
      throw new Error(`Delete failed: ${JSON.stringify(deleteData)}`);
    }
    const deletedInDb = await Review.findById(createdReview._id);
    if (deletedInDb) {
      throw new Error("Review still exists in database after admin deletion!");
    }
    console.log("✓ TEST 8 PASSED: Admin deleted review permanently.");

    console.log("\n=======================================================");
    console.log("🎉 ALL PRODUCT REVIEW & RATING TESTS PASSED PERFECTLY!");
    console.log("=======================================================\n");
  } catch (err) {
    console.error("\n❌ TEST SUITE FAILED:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTestSuite();
