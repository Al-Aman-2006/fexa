import mongoose from "mongoose";

const userRedemptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    redeemedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
      minlength: [3, "Coupon code must be at least 3 characters"],
      maxlength: [30, "Coupon code cannot exceed 30 characters"],
      match: [
        /^[A-Z0-9_-]+$/,
        "Coupon code can only contain letters, numbers, hyphens, and underscores",
      ],
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, "Coupon name cannot exceed 100 characters"],
      default: "",
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, "Description cannot exceed 300 characters"],
      default: "",
    },
    discountType: {
      type: String,
      enum: ["Percentage", "Fixed"],
      default: "Percentage",
    },
    discountPercentage: {
      type: Number,
      required: [true, "Discount percentage is required"],
      min: [1, "Discount percentage must be at least 1%"],
      max: [100, "Discount percentage cannot exceed 100%"],
      validate: {
        validator: function (val) {
          return Number.isFinite(val) && !isNaN(val) && val > 0 && val <= 100;
        },
        message: "Discount percentage must be a valid number between 1 and 100",
      },
    },
    minOrderAmount: {
      type: Number,
      alias: "minimumOrderAmount",
      min: [0, "Minimum order amount cannot be negative"],
      default: 0,
    },
    maxDiscount: {
      type: Number,
      alias: "maximumDiscount",
      min: [0, "Maximum discount cannot be negative"],
      default: null, // null means no cap
    },
    startDate: {
      type: Date,
      required: [true, "Start date and time is required"],
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: [true, "Expiry date and time is required"],
      validate: {
        validator: function (val) {
          if (!this.startDate || !val) return true;
          return new Date(val).getTime() > new Date(this.startDate).getTime();
        },
        message: "Expiry date must be after start date",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    usageLimit: {
      type: Number,
      min: [1, "Usage limit must be at least 1"],
      default: null, // null means unlimited global uses
    },
    usedCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    perUserLimit: {
      type: Number,
      min: [1, "Per-user usage limit must be at least 1"],
      default: 1, // Default each user can use once
    },
    userRedemptions: {
      type: [userRedemptionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save normalization hook
couponSchema.pre("save", function () {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }
});

// Helper instance method to check validity for a given subtotal & user
couponSchema.methods.validateForOrder = function (merchandiseSubtotal, userId) {
  const now = new Date();

  if (this.isArchived) {
    return { valid: false, reason: "Coupon is no longer available" };
  }

  if (!this.isActive) {
    return { valid: false, reason: "Coupon is currently inactive" };
  }

  if (new Date(this.startDate).getTime() > now.getTime()) {
    return {
      valid: false,
      reason: `Coupon is not yet active. Offer commences on ${new Date(this.startDate).toLocaleDateString("en-IN")}`,
    };
  }

  if (new Date(this.expiryDate).getTime() < now.getTime()) {
    return { valid: false, reason: "Coupon has expired" };
  }

  if (this.usageLimit !== null && this.usedCount >= this.usageLimit) {
    return { valid: false, reason: "Coupon total usage limit has been reached" };
  }

  const minRequired = (this.minOrderAmount !== undefined && this.minOrderAmount !== null)
    ? this.minOrderAmount
    : (this.minimumOrderAmount || 0);

  if (minRequired > 0 && merchandiseSubtotal < minRequired) {
    return {
      valid: false,
      reason: `Minimum merchandise subtotal of ₹${minRequired.toLocaleString("en-IN")} required to use this coupon`,
    };
  }

  if (userId && this.perUserLimit) {
    const userUses = this.userRedemptions.filter(
      (r) => r.user && r.user.toString() === userId.toString()
    ).length;

    if (userUses >= this.perUserLimit) {
      return {
        valid: false,
        reason: `You have already redeemed this coupon the maximum allowed times (${this.perUserLimit})`,
      };
    }
  }

  return { valid: true };
};

// Helper instance method to compute actual discount in ₹
couponSchema.methods.calculateDiscount = function (merchandiseSubtotal) {
  const subtotal = Number(merchandiseSubtotal) || 0;
  if (subtotal <= 0) return 0;

  let rawDiscount = 0;
  if (this.discountType === "Percentage") {
    rawDiscount = Math.round((subtotal * this.discountPercentage) / 100);
  } else if (this.discountType === "Fixed") {
    rawDiscount = this.discountPercentage || 0;
  }

  const maxCap = (this.maxDiscount !== undefined && this.maxDiscount !== null)
    ? this.maxDiscount
    : this.maximumDiscount;

  if (maxCap && maxCap > 0) {
    rawDiscount = Math.min(rawDiscount, maxCap);
  }

  return Math.min(rawDiscount, subtotal);
};

const Coupon = mongoose.models.Coupon || mongoose.model("Coupon", couponSchema);

export default Coupon;
