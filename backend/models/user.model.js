const mongoose = require("mongoose");

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
        50,
        "Name cannot exceed 50 characters",
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
      required: [true, "Password is required"],
      minlength: [
        8,
        "Password must be at least 8 characters",
      ],
    },

    phone: {
      type: String,
      trim: true,
      default: "",
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
  },

  {
    timestamps: true,
  }
);


const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);


module.exports = User;