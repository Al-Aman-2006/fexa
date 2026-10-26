import express from "express";
import adminMiddleware from "../middlewares/admin.middleware.js";
import {
  getAdminReviews,
  updateReviewStatus,
  deleteAdminReview,
} from "../controllers/review.controller.js";

const router = express.Router();

// All admin review endpoints require admin authorization
router.use(adminMiddleware);

// GET /api/admin/reviews - All reviews with KPIs, filters, search, pagination
router.get("/", getAdminReviews);

// PATCH /api/admin/reviews/:id/status - Update review status (approve, reject, pending)
router.patch("/:id/status", updateReviewStatus);

// DELETE /api/admin/reviews/:id - Delete review
router.delete("/:id", deleteAdminReview);

export default router;
