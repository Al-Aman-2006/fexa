import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required."],
      trim: true,
      minlength: [2, "Product name must be at least 2 characters."],
      maxlength: [150, "Product name cannot exceed 150 characters."],
      validate: {
        validator: function (v) {
          return /[\p{L}]/u.test(v);
        },
        message: "Product name must contain at least one letter and cannot consist only of numbers or symbols.",
      },
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      required: true,
    },

    description: {
      type: String,
      required: [true, "Product description is required."],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters."],
    },

    brand: {
      type: String,
      required: [true, "Brand is required."],
      trim: true,
      minlength: [2, "Brand must be at least 2 characters."],
      maxlength: [100, "Brand cannot exceed 100 characters."],
      default: "FEXA",
    },

    category: {
      type: String,
      required: [true, "Category is required."],
      trim: true,
      enum: {
        values: ["Men", "Women", "Unisex"],
        message: "Please select a valid category (Men, Women, Unisex).",
      },
    },

    price: {
      type: Number,
      required: [true, "Price is required."],
      min: [0.01, "Price must be greater than zero."],
    },

    compareAtPrice: {
      type: Number,
      min: [0, "Compare price cannot be negative."],
      default: 0,
    },

    stock: {
      type: Number,
      required: [true, "Stock count is required."],
      min: [0, "Stock cannot be negative."],
      validate: {
        validator: Number.isInteger,
        message: "Stock must be an integer.",
      },
      default: 0,
    },

    images: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: ["Active", "Inactive", "Out of Stock"],
      default: "Active",
    },

    variants: {
      type: [
        new mongoose.Schema(
          {
            volumeMl: {
              type: Number,
              required: [true, "Volume in ml is required."],
              min: [1, "Volume must be a positive number."],
              validate: {
                validator: (v) => Number.isFinite(v) && v > 0,
                message: "Volume must be a positive number.",
              },
            },
            sellingPrice: {
              type: Number,
              required: [true, "Selling price is required."],
              min: [0.01, "Selling price must be greater than zero."],
            },
            originalPrice: {
              type: Number,
              min: [0, "Original price cannot be negative."],
              default: 0,
            },
            stock: {
              type: Number,
              required: [true, "Stock count is required."],
              min: [0, "Stock cannot be negative."],
              validate: {
                validator: Number.isInteger,
                message: "Stock must be a non-negative integer.",
              },
              default: 0,
            },
            isAvailable: {
              type: Boolean,
              default: true,
            },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate synchronization: ensure slug and top-level price, compareAtPrice, and stock match variants
productSchema.pre("validate", function () {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  if (this.variants && this.variants.length > 0) {
    // 1. Sync price to minimum active selling price (or first variant if none active)
    const activeVariants = this.variants.filter((v) => v.isAvailable !== false);
    const pool = activeVariants.length > 0 ? activeVariants : this.variants;
    const minVariant = pool.reduce(
      (min, cur) => (cur.sellingPrice < min.sellingPrice ? cur : min),
      pool[0]
    );

    this.price = minVariant.sellingPrice;
    this.compareAtPrice = minVariant.originalPrice || 0;

    // 2. Sync total stock to sum of all variant stocks
    this.stock = this.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

    // 3. If all variants have 0 stock and product was Active, mark Out of Stock
    if (this.stock === 0 && this.status === "Active") {
      this.status = "Out of Stock";
    } else if (this.stock > 0 && this.status === "Out of Stock") {
      this.status = "Active";
    }
  }
});

// Indexes for fast searching, filtering, and sorting
productSchema.index({ name: "text", brand: "text", category: "text" });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ status: 1, name: 1, brand: 1 });
productSchema.index({ createdAt: -1 });

const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);

export default Product;
