const User = require("../models/user.model");


// ========================================
// GET PROFILE
// ========================================

const getProfile = async (req, res) => {
  try {

    // User ID comes from JWT middleware
    const userId = req.user.id;

    const user = await User.findById(userId)
      .select("-password -otpHash -resetPasswordToken");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
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

    const {
      name,
      phone,
    } = req.body;


    // Find logged-in user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }


    // Update name if provided
    if (name !== undefined) {
      user.name = name.trim();
    }


    // Update phone if provided
    if (phone !== undefined) {
      user.phone = phone.trim();
    }


    await user.save();


    res.status(200).json({
      success: true,
      message: "Profile updated successfully",

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
      },
    });

  } catch (error) {

    console.error(
      "Update profile error:",
      error.message
    );

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

    // Save image URL in database
    user.profileImage = `/uploads/${req.file.filename}`;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      profileImage: user.profileImage,
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
// ADD ADDRESS
// ========================================

const addAddress = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      label,
      fullName,
      phone,
      house,
      street,
      city,
      state,
      pincode,
      country,
      isDefault,
    } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Basic validation
    if (
      !fullName?.trim() ||
      !phone?.trim() ||
      !house?.trim() ||
      !street?.trim() ||
      !city?.trim() ||
      !state?.trim() ||
      !pincode?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required address fields",
      });
    }

    // If this address is default,
    // remove default from existing addresses
    if (isDefault) {
      user.addresses.forEach((address) => {
        address.isDefault = false;
      });
    }

    user.addresses.push({
      label: label?.trim() || "Home",
      fullName: fullName.trim(),
      phone: phone.trim(),
      house: house.trim(),
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      country: country?.trim() || "India",
      isDefault: Boolean(isDefault),
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      addresses: user.addresses,
    });
  } catch (error) {
    console.error(
      "Add address error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Unable to add address",
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
    uploadProfileImage,
      addAddress,
};