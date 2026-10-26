import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Review from "../models/review.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";

// Helper to extract authenticated user from cookies or Bearer token (optional auth)
const getOptionalUserId = (req) => {
  try {
    let token = null;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded?.id || null;
    }
  } catch (err) {
    // Ignore invalid/expired token for optional auth
  }
  return null;
};

// =========================================================================
// 1. PUBLIC: GET PRODUCT REVIEWS & RATING SUMMARY
// =========================================================================
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product identifier.",
      });
    }

    // Verify product exists
    const product = await Product.findById(productId).select("_id name status");
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 5));
    const sortParam = (req.query.sort || "newest").toLowerCase().trim();
    const ratingFilter = parseInt(req.query.rating, 10);

    // 1. Compute rating summary across all approved reviews
    const summary = await Review.getProductRatingSummary(productId);

    // 2. Query filter for approved reviews
    const queryFilter = {
      product: productId,
      status: "approved",
    };

    if (ratingFilter >= 1 && ratingFilter <= 5) {
      queryFilter.rating = ratingFilter;
    }

    // Sorting
    let sortOptions = { createdAt: -1 };
    if (sortParam === "highest") {
      sortOptions = { rating: -1, createdAt: -1 };
    } else if (sortParam === "lowest") {
      sortOptions = { rating: 1, createdAt: -1 };
    } else if (sortParam === "oldest") {
      sortOptions = { createdAt: 1 };
    }

    const totalFilteredReviews = await Review.countDocuments(queryFilter);
    const totalPages = Math.ceil(totalFilteredReviews / limit) || 1;

    const reviews = await Review.find(queryFilter)
      .populate({
        path: "user",
        select: "name profileImage email",
      })
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(limit);

    // 3. Check if current visitor is authenticated and has a review (even if pending)
    let userReview = null;
    const currentUserId = getOptionalUserId(req);
    if (currentUserId) {
      userReview = await Review.findOne({
        product: productId,
        user: currentUserId,
      }).populate({
        path: "user",
        select: "name profileImage email",
      });
    }

    return res.status(200).json({
      success: true,
      summary,
      ratingSummary: summary,
      reviews,
      userReview,
      pagination: {
        page,
        limit,
        total: totalFilteredReviews,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get product reviews error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load reviews for this product.",
    });
  }
};

// =========================================================================
// 2. USER: SUBMIT PRODUCT REVIEW
// =========================================================================
export const submitProductReview = async (req, res) => {
  try {
    const productId = req.params.productId || req.body.productId;
    const userId = req.user.id;
    const { rating, title = "", comment } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product identifier.",
      });
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Fragrance not found.",
      });
    }

    // Validate rating
    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid star rating between 1 and 5.",
      });
    }

    // Validate comment
    const trimmedComment = (comment || "").trim();
    if (!trimmedComment || trimmedComment.length < 5) {
      return res.status(400).json({
        success: false,
        message: "Review comment must be at least 5 characters long.",
      });
    }
    if (trimmedComment.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Review comment cannot exceed 1000 characters.",
      });
    }

    const trimmedTitle = (title || "").trim().slice(0, 100);

    // Check if user already submitted a review for this product
    const existingReview = await Review.findOne({
      product: productId,
      user: userId,
    });

    if (existingReview) {
      // Update existing review and re-queue for moderation
      existingReview.rating = parsedRating;
      existingReview.title = trimmedTitle;
      existingReview.comment = trimmedComment;
      existingReview.status = "pending"; // Re-queued for moderation
      await existingReview.save();

      return res.status(200).json({
        success: true,
        message: "Your review has been updated and submitted for atelier moderation.",
        review: existingReview,
        isUpdate: true,
      });
    }

    // Create new review
    const newReview = await Review.create({
      product: productId,
      user: userId,
      rating: parsedRating,
      title: trimmedTitle,
      comment: trimmedComment,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Thank you! Your review has been submitted and is pending atelier approval.",
      review: newReview,
      isUpdate: false,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted a review for this fragrance.",
      });
    }
    console.error("Submit product review error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to submit your review. Please try again.",
    });
  }
};

// =========================================================================
// 3. USER: UPDATE OWN REVIEW
// =========================================================================
export const updateUserReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;
    const { rating, title = "", comment } = req.body;

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review identifier.",
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found.",
      });
    }

    // Verify ownership
    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to modify this review.",
      });
    }

    // Validate rating if provided
    if (rating !== undefined) {
      const parsedRating = Number(rating);
      if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({
          success: false,
          message: "Please select a valid star rating between 1 and 5.",
        });
      }
      review.rating = parsedRating;
    }

    // Validate comment if provided
    if (comment !== undefined) {
      const trimmedComment = (comment || "").trim();
      if (!trimmedComment || trimmedComment.length < 5) {
        return res.status(400).json({
          success: false,
          message: "Review comment must be at least 5 characters long.",
        });
      }
      if (trimmedComment.length > 1000) {
        return res.status(400).json({
          success: false,
          message: "Review comment cannot exceed 1000 characters.",
        });
      }
      review.comment = trimmedComment;
    }

    if (title !== undefined) {
      review.title = (title || "").trim().slice(0, 100);
    }

    // Re-queue updated review for moderation
    review.status = "pending";
    await review.save();

    return res.status(200).json({
      success: true,
      message: "Your review has been updated and submitted for atelier moderation.",
      review,
    });
  } catch (error) {
    console.error("Update review error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update review.",
    });
  }
};

// =========================================================================
// 4. USER: DELETE OWN REVIEW
// =========================================================================
export const deleteUserReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review identifier.",
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found.",
      });
    }

    // Verify ownership
    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this review.",
      });
    }

    await Review.findByIdAndDelete(reviewId);

    return res.status(200).json({
      success: true,
      message: "Your review has been removed.",
    });
  } catch (error) {
    console.error("Delete review error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete review.",
    });
  }
};

// =========================================================================
// 5. ADMIN: GET ALL REVIEWS (With KPIs, Filtering, Search, Pagination)
// =========================================================================
export const getAdminReviews = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const status = (req.query.status || "All").trim();
    const search = (req.query.search || "").trim();
    const rating = parseInt(req.query.rating, 10);
    const productId = req.query.productId?.trim();
    const sortParam = (req.query.sort || "newest").toLowerCase().trim();

    // 1. KPI Counts
    const [totalReviews, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      Review.countDocuments({}),
      Review.countDocuments({ status: "pending" }),
      Review.countDocuments({ status: "approved" }),
      Review.countDocuments({ status: "rejected" }),
    ]);

    // Average rating across approved reviews
    const approvedAvgStats = await Review.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: null, avgRating: { $avg: "$rating" } } },
    ]);
    const averageRating = approvedAvgStats.length > 0 ? Number(approvedAvgStats[0].avgRating.toFixed(1)) : 0;

    // 2. Query filter
    const queryFilter = {};

    if (status && status !== "All") {
      queryFilter.status = status.toLowerCase();
    }

    if (rating >= 1 && rating <= 5) {
      queryFilter.rating = rating;
    }

    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      queryFilter.product = productId;
    }

    // Cross-model search support for product name or user name/email
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(safeSearch, "i");

      const [matchingProducts, matchingUsers] = await Promise.all([
        Product.find({ $or: [{ name: searchRegex }, { brand: searchRegex }] }).select("_id"),
        User.find({ $or: [{ name: searchRegex }, { email: searchRegex }] }).select("_id"),
      ]);

      const productIds = matchingProducts.map((p) => p._id);
      const userIds = matchingUsers.map((u) => u._id);

      queryFilter.$or = [
        { product: { $in: productIds } },
        { user: { $in: userIds } },
        { comment: searchRegex },
        { title: searchRegex },
      ];
    }

    // Sort order
    let sortOptions = { createdAt: -1 };
    if (sortParam === "oldest") {
      sortOptions = { createdAt: 1 };
    } else if (sortParam === "highest") {
      sortOptions = { rating: -1, createdAt: -1 };
    } else if (sortParam === "lowest") {
      sortOptions = { rating: 1, createdAt: -1 };
    }

    const totalFiltered = await Review.countDocuments(queryFilter);
    const totalPages = Math.ceil(totalFiltered / limit) || 1;

    const reviews = await Review.find(queryFilter)
      .populate({
        path: "product",
        select: "name slug brand category price compareAtPrice images status",
      })
      .populate({
        path: "user",
        select: "name email profileImage",
      })
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json({
      success: true,
      kpis: {
        totalReviews,
        pendingCount,
        approvedCount,
        rejectedCount,
        averageRating,
      },
      metrics: {
        totalReviews,
        pendingCount,
        approvedCount,
        rejectedCount,
        averageRating,
      },
      reviews,
      pagination: {
        page,
        limit,
        total: totalFiltered,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get admin reviews error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load reviews for admin panel.",
    });
  }
};

// =========================================================================
// 6. ADMIN: UPDATE REVIEW STATUS (Approve / Reject / Pending / Hide)
// =========================================================================
export const updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review identifier.",
      });
    }

    const validStatuses = ["approved", "rejected", "pending"];
    if (!status || !validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved, rejected, or pending.",
      });
    }

    const review = await Review.findById(id)
      .populate("product", "name brand category")
      .populate("user", "name email");

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found.",
      });
    }

    review.status = status.toLowerCase();
    await review.save();

    return res.status(200).json({
      success: true,
      message: `Review status updated to ${review.status}.`,
      review,
    });
  } catch (error) {
    console.error("Update review status error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update review status.",
    });
  }
};

// =========================================================================
// 7. ADMIN: DELETE REVIEW
// =========================================================================
export const deleteAdminReview = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review identifier.",
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found.",
      });
    }

    await Review.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully.",
    });
  } catch (error) {
    console.error("Delete admin review error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete review.",
    });
  }
};

export default {
  getProductReviews,
  submitProductReview,
  updateUserReview,
  deleteUserReview,
  getAdminReviews,
  updateReviewStatus,
  deleteAdminReview,
};
