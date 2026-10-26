import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import {
  getProductReviews,
  submitProductReview,
  updateUserReview,
  deleteUserReview,
} from "../controllers/review.controller.js";

const router = express.Router();

// GET /api/reviews/product/:productId - Public product reviews & rating summary
router.get("/product/:productId", getProductReviews);

// POST /api/reviews or /api/reviews/product/:productId - Submit review (authenticated user)
router.post("/", authMiddleware, submitProductReview);
router.post("/product/:productId", authMiddleware, submitProductReview);

// PUT /api/reviews/:reviewId - Update own review (authenticated user)
router.put("/:reviewId", authMiddleware, updateUserReview);

// DELETE /api/reviews/:reviewId - Delete own review (authenticated user)
router.delete("/:reviewId", authMiddleware, deleteUserReview);

export default router;
