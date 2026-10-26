import mongoose from "mongoose";

const ALLOWED_REASONS = [
  "General Inquiry",
  "Fragrance Information",
  "Order Support",
  "Shipping and Delivery",
  "Returns and Refunds",
  "Product Availability",
  "Other",
];

const contactMessageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      maxlength: [254, "Email cannot exceed 254 characters"],
    },
    reason: {
      type: String,
      required: [true, "Reason for contact is required"],
      enum: {
        values: ALLOWED_REASONS,
        message: "Invalid reason for contact selected",
      },
      trim: true,
    },
    orderNumber: {
      type: String,
      trim: true,
      default: null,
      maxlength: [50, "Order number cannot exceed 50 characters"],
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      minlength: [3, "Subject must be at least 3 characters"],
      maxlength: [120, "Subject cannot exceed 120 characters"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      minlength: [10, "Message must be at least 10 characters"],
      maxlength: [1500, "Message cannot exceed 1500 characters"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["New", "In Review", "Resolved"],
      default: "New",
    },
    emailDelivered: {
      type: Boolean,
      default: false,
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

contactMessageSchema.index({ createdAt: -1 });
contactMessageSchema.index({ email: 1 });
contactMessageSchema.index({ user: 1 });

const ContactMessage =
  mongoose.models.ContactMessage ||
  mongoose.model("ContactMessage", contactMessageSchema);

export { ContactMessage, ALLOWED_REASONS };
export default {
  ContactMessage,
  ALLOWED_REASONS,
};
