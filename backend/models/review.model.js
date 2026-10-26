import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required."],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required."],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, "Rating is required."],
      min: [1, "Rating must be at least 1."],
      max: [5, "Rating cannot exceed 5."],
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number between 1 and 5.",
      },
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, "Review headline cannot exceed 100 characters."],
      default: "",
    },
    comment: {
      type: String,
      required: [true, "Review comment is required."],
      trim: true,
      minlength: [5, "Review comment must be at least 5 characters."],
      maxlength: [1000, "Review comment cannot exceed 1000 characters."],
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected"],
        message: "Status must be pending, approved, or rejected.",
      },
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: a user can only submit one review per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Query indexes for fast sorting and filtering
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ createdAt: -1 });

// Helper static method to compute aggregate rating metrics for a product
reviewSchema.statics.getProductRatingSummary = async function (productId) {
  const prodId = new mongoose.Types.ObjectId(productId);

  const stats = await this.aggregate([
    {
      $match: {
        product: prodId,
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
  ]);

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let totalReviews = 0;
  let totalScore = 0;

  stats.forEach((item) => {
    const star = item._id;
    if (distribution[star] !== undefined) {
      distribution[star] = item.count;
      totalReviews += item.count;
      totalScore += star * item.count;
    }
  });

  const averageRating = totalReviews > 0 ? Number((totalScore / totalReviews).toFixed(1)) : 0;

  const percentages = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  if (totalReviews > 0) {
    for (let s = 1; s <= 5; s++) {
      percentages[s] = Math.round((distribution[s] / totalReviews) * 100);
    }
  }

  return {
    averageRating,
    totalReviews,
    distribution,
    percentages,
  };
};

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);

export default Review;
