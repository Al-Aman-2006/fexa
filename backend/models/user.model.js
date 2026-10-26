import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // ========================================
    // BASIC USER DETAILS
    // ========================================

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [
        2,
        "Name must be at least 2 characters",
      ],
      maxlength: [
        100,
        "Name cannot exceed 100 characters",
      ],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address",
      ],
    },

    password: {
      type: String,
      required: function () {
        return this.authProvider === "local";
      },
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    // ========================================
    // AUTHENTICATION PROVIDER
    // ========================================

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    googleId: {
      type: String,
      default: null,
    },

    // ========================================
    // ROLE & ACCOUNT STATUS
    // ========================================

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },


    // ========================================
    // EMAIL VERIFICATION
    // ========================================

    emailVerified: {
      type: Boolean,
      default: false,
    },

    otpHash: {
      type: String,
      default: null,
    },

    otpExpiresAt: {
      type: Date,
      default: null,
    },


    // ========================================
    // PASSWORD RESET
    // ========================================

    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordExpiresAt: {
      type: Date,
      default: null,
    },


    // ========================================
    // PROFILE
    // ========================================

    profileImage: {
      type: String,
      default: "",
    },


    // ========================================
    // EMAIL CHANGE VERIFICATION
    // ========================================

    pendingEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },

    emailChangeOtpHash: {
      type: String,
      default: null,
    },

    emailChangeOtpExpiresAt: {
      type: Date,
      default: null,
    },


    // ========================================
    // ADDRESSES
    // ========================================

    addresses: [
      {
        label: {
          type: String,
          default: "Home",
          trim: true,
        },

        fullName: {
          type: String,
          trim: true,
          default: "",
        },

        phone: {
          type: String,
          trim: true,
          default: "",
        },

        house: {
          type: String,
          trim: true,
          default: "",
        },

        street: {
          type: String,
          trim: true,
          default: "",
        },

        city: {
          type: String,
          trim: true,
          default: "",
        },

        state: {
          type: String,
          trim: true,
          default: "",
        },

        pincode: {
          type: String,
          trim: true,
          default: "",
        },

        country: {
          type: String,
          trim: true,
          default: "India",
        },

        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // ========================================
    // WISHLIST
    // ========================================

    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },

  {
    timestamps: true,
  }
);


const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);


export default User;