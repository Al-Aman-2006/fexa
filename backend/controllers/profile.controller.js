const User = require("../models/user.model");
const fs = require("fs");
const path = require("path");
const { validateAddress } = require("../validators/address.validator");
const { validateName, normalizeName } = require("../validators/user.validator");


// ========================================
// GET PROFILE
// ========================================

const getProfile = async (req, res) => {
  try {

    // User ID comes from JWT middleware
    const userId = req.user.id;

    const user = await User.findById(userId)
      .select("-password -otpHash -resetPasswordToken -emailChangeOtpHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.googleId && user.authProvider !== "google") {
      user.authProvider = "google";
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      user,
    });

  } catch (error) {

    console.error(
      "Get profile error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Unable to fetch profile",
    });
  }
};


// ========================================
// UPDATE PROFILE
// ========================================

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, email } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.googleId && user.authProvider !== "google") {
      user.authProvider = "google";
      await user.save();
    }

    if (name !== undefined) {
      const nameError = validateName(name);
      if (nameError) {
        return res.status(400).json({
          success: false,
          message: nameError,
          errors: {
            name: nameError,
          },
        });
      }
      user.name = normalizeName(name);
    }

    if (phone !== undefined) {
      user.phone = phone.trim();
    }

    let emailChangeRequested = false;

    if (email && email.trim().toLowerCase() !== user.email.toLowerCase()) {
      if (user.authProvider === "google" || user.googleId) {
        return res.status(400).json({
          success: false,
          message: "Email cannot be changed for accounts authenticated with Google.",
        });
      }

      const targetEmail = email.trim().toLowerCase();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(targetEmail)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address.",
        });
      }

      const existingUser = await User.findOne({
        email: targetEmail,
        _id: { $ne: userId },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "An account with this email already exists.",
        });
      }

      const { generateOtp, hashOtp } = require("../utils/otp");
      const { sendEmailChangeOtpEmail } = require("../services/email.service");

      const otp = generateOtp();
      const otpHash = hashOtp(otp);
      const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

      user.pendingEmail = targetEmail;
      user.emailChangeOtpHash = otpHash;
      user.emailChangeOtpExpiresAt = otpExpiresAt;

      await sendEmailChangeOtpEmail(targetEmail, otp);
      emailChangeRequested = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: emailChangeRequested
        ? "Verification code sent to the new email address."
        : "Profile updated successfully",
      emailChangePending: emailChangeRequested,
      pendingEmail: user.pendingEmail,
      emailChangeOtpExpiresAt: user.emailChangeOtpExpiresAt,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        authProvider: user.authProvider || "local",
        profileImage: user.profileImage,
        pendingEmail: user.pendingEmail,
        emailChangeOtpExpiresAt: user.emailChangeOtpExpiresAt,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to update profile",
    });
  }
};


// ========================================
// UPLOAD PROFILE IMAGE
// ========================================

const uploadProfileImage = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select an image",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete old profile image if it exists in uploads folder
    if (user.profileImage && user.profileImage.startsWith("/uploads/")) {
      const oldFilename = path.basename(user.profileImage);
      const oldPath = path.join(__dirname, "../uploads", oldFilename);
      if (fs.existsSync(oldPath)) {
        fs.unlink(oldPath, (err) => {
          if (err) console.error("Error removing old profile image:", err);
        });
      }
    }

    // Save image URL in database
    user.profileImage = `/uploads/${req.file.filename}`;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      profileImage: user.profileImage,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        authProvider: user.authProvider || "local",
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error(
      "Upload profile image error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Unable to upload profile image",
    });
  }
};


// ========================================
// GET ADDRESSES
// ========================================

const getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("addresses");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Addresses fetched successfully",
      addresses: user.addresses || [],
    });
  } catch (error) {
    console.error("Get addresses error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to retrieve addresses",
    });
  }
};

// ========================================
// ADD ADDRESS
// ========================================

const addAddress = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { isValid, errors, normalizedData } = validateAddress(req.body);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Address validation failed.",
        errors,
      });
    }

    // If this address is default, remove default from existing addresses
    if (normalizedData.isDefault) {
      user.addresses.forEach((address) => {
        address.isDefault = false;
      });
    } else if (user.addresses.length === 0) {
      // If first address, make it default automatically
      normalizedData.isDefault = true;
    }

    user.addresses.push(normalizedData);

    await user.save();

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      addresses: user.addresses,
    });
  } catch (error) {
    console.error("Add address error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to add address",
    });
  }
};

// ========================================
// UPDATE ADDRESS
// ========================================

const updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Find the address subdocument belonging to this user
    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or unauthorized.",
      });
    }

    const { isValid, errors, normalizedData } = validateAddress(req.body);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Address validation failed.",
        errors,
      });
    }

    // If setting as default, clear default on other addresses
    if (normalizedData.isDefault) {
      user.addresses.forEach((addr) => {
        if (addr._id.toString() !== addressId) {
          addr.isDefault = false;
        }
      });
    }

    // Update address properties
    address.label = normalizedData.label;
    address.fullName = normalizedData.fullName;
    address.phone = normalizedData.phone;
    address.house = normalizedData.house;
    address.street = normalizedData.street;
    address.city = normalizedData.city;
    address.state = normalizedData.state;
    address.pincode = normalizedData.pincode;
    address.country = normalizedData.country;
    address.isDefault = normalizedData.isDefault;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      addresses: user.addresses,
    });
  } catch (error) {
    console.error("Update address error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to update address",
    });
  }
};

// ========================================
// DELETE ADDRESS
// ========================================

const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or unauthorized.",
      });
    }

    const wasDefault = address.isDefault;
    user.addresses.pull(addressId);

    // If the deleted address was default and other addresses remain, make the first one default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
      addresses: user.addresses,
    });
  } catch (error) {
    console.error("Delete address error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to delete address",
    });
  }
};

// ========================================
// VERIFY EMAIL CHANGE
// ========================================

const verifyEmailChange = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "Verification code is required.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.pendingEmail || !user.emailChangeOtpHash || !user.emailChangeOtpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "No pending email change request found.",
      });
    }

    if (new Date() > user.emailChangeOtpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new code.",
      });
    }

    const { hashOtp } = require("../utils/otp");
    const enteredOtpHash = hashOtp(otp);

    if (enteredOtpHash !== user.emailChangeOtpHash) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      });
    }

    const existingUser = await User.findOne({
      email: user.pendingEmail,
      _id: { $ne: userId },
    });

    if (existingUser) {
      user.pendingEmail = null;
      user.emailChangeOtpHash = null;
      user.emailChangeOtpExpiresAt = null;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    user.email = user.pendingEmail;
    user.pendingEmail = null;
    user.emailChangeOtpHash = null;
    user.emailChangeOtpExpiresAt = null;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Email updated successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        authProvider: user.authProvider || "local",
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error("Verify email change error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to verify email change",
    });
  }
};

// ========================================
// RESEND EMAIL CHANGE OTP
// ========================================

const resendEmailChangeOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.pendingEmail) {
      return res.status(400).json({
        success: false,
        message: "No pending email change request found.",
      });
    }

    const { generateOtp, hashOtp } = require("../utils/otp");
    const { sendEmailChangeOtpEmail } = require("../services/email.service");

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    user.emailChangeOtpHash = otpHash;
    user.emailChangeOtpExpiresAt = otpExpiresAt;

    await user.save();

    await sendEmailChangeOtpEmail(user.pendingEmail, otp);

    res.status(200).json({
      success: true,
      message: "New verification code sent to your new email address.",
      emailChangeOtpExpiresAt: user.emailChangeOtpExpiresAt,
    });
  } catch (error) {
    console.error("Resend email change OTP error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to resend verification code",
    });
  }
};

module.exports = {
  getProfile,
  getAddresses,
  updateProfile,
  uploadProfileImage,
  addAddress,
  updateAddress,
  deleteAddress,
  verifyEmailChange,
  resendEmailChangeOtp,
};