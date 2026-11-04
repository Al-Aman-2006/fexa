import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required."],
      trim: true,
      minlength: [2, "Category name must be at least 2 characters."],
      maxlength: [100, "Category name cannot exceed 100 characters."],
    },

    slug: {
      type: String,
      required: [true, "Category slug is required."],
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    image: {
      type: String,
      trim: true,
      default: "",
    },

    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: Unique category name under the same parent category (or among parent categories where parentCategory is null)
categorySchema.index({ parentCategory: 1, name: 1 }, { unique: true });
categorySchema.index({ isActive: 1, parentCategory: 1 });

const Category =
  mongoose.models.Category || mongoose.model("Category", categorySchema);

export default Category;
