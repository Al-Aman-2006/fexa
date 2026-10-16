const bcrypt = require("bcryptjs");
const User = require("../models/user.model");

// Helper: Email format validation
const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// ========================================
// GET ALL USERS (WITH SEARCH & PAGINATION)
// ========================================

const getUsers = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));

    const filter = {};

    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit) || 1;
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;

    const users = await User.find(filter)
      .select("-password -otpHash -resetPasswordToken -emailChangeOtpHash -__v")
      .sort({ createdAt: -1 }) // Latest users first
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      users,
      pagination: {
        page: safePage,
        limit,
        totalUsers,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get admin users error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load user list.",
    });
  }
};

// ========================================
// CREATE USER
// ========================================

const createUser = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const errors = {};

    if (!name || !name.trim()) {
      errors.name = "Name is required.";
    } else if (name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters.";
    }

    if (!email || !email.trim()) {
      errors.email = "Email is required.";
    } else if (!validateEmail(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
        errors: {
          email: "An account with this email already exists.",
        },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone ? phone.trim() : "",
      role: "user",
      authProvider: "local",
      emailVerified: true,
      isBlocked: false,
    });

    res.status(201).json({
      success: true,
      message: "User created successfully.",
      user: {
        _id: newUser._id,
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        authProvider: newUser.authProvider,
        isBlocked: newUser.isBlocked,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error("Create user error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to create user.",
    });
  }
};

// ========================================
// UPDATE USER
// ========================================

const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (name !== undefined && name.trim()) {
      if (name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Name must be at least 2 characters.",
        });
      }
      user.name = name.trim();
    }

    if (phone !== undefined) {
      user.phone = phone.trim();
    }

    if (email && email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const targetEmail = email.trim().toLowerCase();

      if (user.authProvider === "google" || user.googleId) {
        return res.status(400).json({
          success: false,
          message: "Email cannot be updated for accounts authenticated with Google.",
        });
      }

      if (!validateEmail(targetEmail)) {
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

      user.email = targetEmail;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "User updated successfully.",
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        authProvider: user.authProvider,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Update user error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to update user.",
    });
  }
};

// ========================================
// DELETE USER
// ========================================

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    if (req.admin && req.admin._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "Admin cannot delete their own account.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Admin accounts cannot be deleted.",
      });
    }

    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "User deleted successfully.",
    });
  } catch (error) {
    console.error("Delete user error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to delete user.",
    });
  }
};

// ========================================
// BLOCK USER
// ========================================

const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    if (req.admin && req.admin._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "Admin cannot block their own account.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.isBlocked = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User blocked successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isBlocked: user.isBlocked,
      },
    });
  } catch (error) {
    console.error("Block user error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to block user.",
    });
  }
};

// ========================================
// UNBLOCK USER
// ========================================

const unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.isBlocked = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User unblocked successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isBlocked: user.isBlocked,
      },
    });
  } catch (error) {
    console.error("Unblock user error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to unblock user.",
    });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  blockUser,
  unblockUser,
};
