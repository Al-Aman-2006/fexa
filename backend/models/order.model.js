const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
    },
    brand: {
      type: String,
      default: "FEXA",
    },
    category: {
      type: String,
      default: "Unisex",
    },
    volumeMl: {
      type: Number,
      required: [true, "Volume in ml is required"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
      max: [5, "Quantity cannot exceed 5"],
    },
    unitPrice: {
      type: Number,
      required: [true, "Unit price is required"],
      min: [0, "Unit price cannot be negative"],
    },
    originalPrice: {
      type: Number,
      default: null,
    },
    lineTotal: {
      type: Number,
      required: [true, "Line total is required"],
      min: [0, "Line total cannot be negative"],
    },
    image: {
      type: String,
      default: null,
    },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [
        (val) => Array.isArray(val) && val.length > 0,
        "Order must contain at least one item",
      ],
    },
    shippingAddress: {
      addressId: { type: mongoose.Schema.Types.ObjectId, required: false },
      label: { type: String, default: "Home" },
      fullName: { type: String, default: "" },
      phone: { type: String, default: "" },
      house: { type: String, default: "" },
      street: { type: String, default: "" },
      addressLine: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
      country: { type: String, default: "India" },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "Card", "UPI", "NetBanking"],
      default: "COD",
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },
    orderStatus: {
      type: String,
      enum: ["Processing", "Dispatched", "Delivered", "Cancelled"],
      default: "Processing",
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

module.exports = Order;
