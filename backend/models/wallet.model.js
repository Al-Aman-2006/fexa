import mongoose from "mongoose";

export const TRANSACTION_TYPES = {
  TOP_UP: "Top-up",
  RETURN_REFUND: "Return Refund",
  PURCHASE_DEBIT: "Purchase Debit",
  CANCELLATION_REFUND: "Cancellation Refund",
  ADMIN_ADJUSTMENT: "Admin Adjustment",
};

export const TRANSACTION_DIRECTIONS = {
  CREDIT: "Credit",
  DEBIT: "Debit",
};

export const TRANSACTION_STATUSES = {
  COMPLETED: "Completed",
  PENDING: "Pending",
  FAILED: "Failed",
};

const walletTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "Top-up",
        "TOPUP",
        "TOP_UP",
        "Return Refund",
        "REFUND",
        "RETURN_REFUND",
        "Purchase Debit",
        "PURCHASE",
        "PURCHASE_DEBIT",
        "DEBIT",
        "Cancellation Refund",
        "CANCELLATION",
        "CANCELLATION_REFUND",
        "Admin Adjustment",
        "ADMIN_ADJUSTMENT",
      ],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Transaction amount must be greater than zero"],
    },
    direction: {
      type: String,
      enum: ["Credit", "CREDIT", "Debit", "DEBIT"],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    referenceId: {
      type: String,
      default: null,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    productName: {
      type: String,
      default: null,
    },
    itemPrice: {
      type: Number,
      default: 0,
    },
    itemOfferDiscount: {
      type: Number,
      default: 0,
    },
    itemCouponDiscount: {
      type: Number,
      default: 0,
    },
    itemQuantity: {
      type: Number,
      default: 1,
    },
    refundReason: {
      type: String,
      default: null,
    },
    returnRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReturnRequest",
      default: null,
    },
    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      index: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        "Completed",
        "COMPLETED",
        "SUCCESS",
        "Success",
        "Pending",
        "PENDING",
        "Failed",
        "FAILED",
      ],
      default: "Completed",
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { _id: true }
);

// Pre-validation hook to normalize transaction direction, status, and type to canonical forms
walletTransactionSchema.pre("validate", function (next) {
  if (this.direction) {
    const dirUpper = String(this.direction).trim().toUpperCase();
    if (dirUpper === "CREDIT") this.direction = "Credit";
    else if (dirUpper === "DEBIT") this.direction = "Debit";
  }

  if (this.status) {
    const statUpper = String(this.status).trim().toUpperCase();
    if (statUpper === "SUCCESS" || statUpper === "COMPLETED" || statUpper === "SUCCESSFUL") this.status = "Completed";
    else if (statUpper === "PENDING") this.status = "Pending";
    else if (statUpper === "FAILED") this.status = "Failed";
  }

  if (this.type) {
    const typeUpper = String(this.type).trim().toUpperCase().replace(/[- ]/g, "_");
    if (typeUpper === "TOPUP" || typeUpper === "TOP_UP") this.type = "Top-up";
    else if (typeUpper === "REFUND" || typeUpper === "RETURN_REFUND") this.type = "Return Refund";
    else if (typeUpper === "PURCHASE" || typeUpper === "PURCHASE_DEBIT" || typeUpper === "DEBIT") this.type = "Purchase Debit";
    else if (typeUpper === "CANCELLATION" || typeUpper === "CANCELLATION_REFUND") this.type = "Cancellation Refund";
    else if (typeUpper === "ADMIN_ADJUSTMENT" || typeUpper === "ADJUSTMENT") this.type = "Admin Adjustment";
  }

  if (typeof next === "function") next();
});

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, "Wallet balance cannot be negative"],
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    transactions: [walletTransactionSchema],
  },
  {
    timestamps: true,
  }
);

// Helper method to safely format balance
walletSchema.methods.formatBalance = function () {
  return Math.round(this.balance * 100) / 100;
};

const Wallet = mongoose.models.Wallet || mongoose.model("Wallet", walletSchema);

export default Wallet;
