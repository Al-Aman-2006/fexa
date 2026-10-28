import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Offer name is required"],
      trim: true,
      minlength: [3, "Offer name must be at least 3 characters"],
      maxlength: [120, "Offer name cannot exceed 120 characters"],
      validate: {
        validator: function (v) {
          if (typeof v !== "string") return false;
          const clean = v.trim();
          if (clean.length < 3 || clean.length > 120) return false;
          if (/^\d+$/.test(clean)) return false;
          if (!/[a-zA-Z]/.test(clean)) return false;
          return true;
        },
        message: "Offer name must be 3-120 characters and contain at least one letter",
      },
    },

    description: {
      type: String,
      trim: true,
      maxlength: [300, "Description cannot exceed 300 characters"],
      default: "",
    },

    discountType: {
      type: String,
      enum: {
        values: ["Percentage", "Fixed"],
        message: "Discount type must be either Percentage or Fixed",
      },
      default: "Percentage",
    },

    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      validate: {
        validator: function (val) {
          if (typeof val !== "number" || !Number.isFinite(val) || Number.isNaN(val)) {
            return false;
          }
          if (this.discountType === "Percentage") {
            return val > 0 && val <= 100;
          }
          return val > 0;
        },
        message:
          "Discount value must be a valid positive number (1% - 100% for percentage discounts)",
      },
    },

    scope: {
      type: String,
      required: [true, "Offer scope is required"],
      enum: {
        values: ["all", "category", "product", "products"],
        message: "Scope must be 'all', 'category', 'product', or 'products'",
      },
      default: "all",
    },

    category: {
      type: String,
      trim: true,
      enum: {
        values: ["Men", "Women", "Unisex", null, ""],
        message: "Category must be Men, Women, or Unisex",
      },
      default: null,
      validate: {
        validator: function (val) {
          if (this.scope === "category") {
            return ["Men", "Women", "Unisex"].includes(val);
          }
          return true;
        },
        message: "Please select a valid category (Men, Women, or Unisex) for category-scoped offers",
      },
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      validate: {
        validator: function (val) {
          if (this.scope === "product") {
            return val != null && mongoose.Types.ObjectId.isValid(val);
          }
          return true;
        },
        message: "Please select a valid product for product-scoped offers",
      },
    },

    productIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
      ],
      default: [],
      validate: {
        validator: function (arr) {
          if (this.scope === "products") {
            return Array.isArray(arr) && arr.length > 0;
          }
          return true;
        },
        message: "Please select at least one product for multi-product scoped offers",
      },
    },

    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      default: Date.now,
    },

    endDate: {
      type: Date,
      required: [true, "End date is required"],
      validate: {
        validator: function (val) {
          if (!val) return false;
          return new Date(val).getTime() > new Date(this.startDate || Date.now()).getTime();
        },
        message: "End date and time must be after the start date and time",
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

    minPurchaseAmount: {
      type: Number,
      min: [0, "Minimum purchase amount cannot be negative"],
      default: 0,
    },

    maxDiscount: {
      type: Number,
      min: [0, "Maximum discount cap cannot be negative"],
      default: null,
    },

    priority: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Helpful Compound Indexes for query performance
offerSchema.index({ isActive: 1, isArchived: 1, startDate: 1, endDate: 1 });
offerSchema.index({ scope: 1, category: 1 });
offerSchema.index({ productId: 1 });
offerSchema.index({ productIds: 1 });

/**
 * Check whether the offer is currently valid according to current time and status flags.
 */
offerSchema.methods.isCurrentlyValid = function (referenceTime = new Date()) {
  if (!this.isActive || this.isArchived) return false;
  const time = new Date(referenceTime).getTime();
  const start = new Date(this.startDate).getTime();
  const end = new Date(this.endDate).getTime();
  return time >= start && time <= end;
};

const Offer = mongoose.model("Offer", offerSchema);

export default Offer;
