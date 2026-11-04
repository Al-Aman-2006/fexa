import mongoose from "mongoose";

export const RETURN_REASONS = [
  "Product damaged",
  "Product leaked or packaging damaged",
  "Wrong product received",
  "Incorrect perfume variant or size received",
  "Product quality issue",
  "Product does not match the description",
  "Received an incorrect quantity",
  "Other",
];

export const RETURN_STATUSES = [
  "Requested",
  "Under Review",
  "Approved",
  "Rejected",
  "Refund Processing",
  "Refunded",
];

const returnItemSnapshotSchema = new mongoose.Schema(
  {
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    variantVolume: {
      type: String,
      default: "100ml",
    },
    volumeMl: {
      type: Number,
      default: 100,
    },
    purchasedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    requestedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    perUnitOfferDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
    perUnitCouponDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountedUnitAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    image: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const returnRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
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
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      index: true,
    },
    item: {
      type: returnItemSnapshotSchema,
      required: true,
    },
    returnReason: {
      type: String,
      enum: RETURN_REASONS,
      required: [true, "Please select a valid reason for return."],
      index: true,
    },
    customerNotes: {
      type: String,
      default: "",
      trim: true,
    },
    evidenceImages: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: RETURN_STATUSES,
      default: "Requested",
      index: true,
    },
    eligibleRefundAmount: {
      type: Number,
      required: true,
      min: [0, "Eligible refund amount cannot be negative"],
    },
    actualRefundAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    adminNotes: {
      type: String,
      default: "",
      trim: true,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    decisionDate: {
      type: Date,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
    walletTransactionId: {
      type: String,
      default: null,
      index: true,
    },
    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        adminEmail: {
          type: String,
          default: null,
        },
        note: {
          type: String,
          default: "",
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Pre-validate generator for requestNumber
returnRequestSchema.pre("validate", function () {
  if (!this.requestNumber) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    this.requestNumber = `RET-${Date.now()}-${rand}`;
  }
});

const ReturnRequest =
  mongoose.models.ReturnRequest ||
  mongoose.model("ReturnRequest", returnRequestSchema);

export default ReturnRequest;
