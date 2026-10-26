import {
  registerUser,
  loginUser,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  googleLoginUser,
} from "../services/auth.service.js";
import { validateName, normalizeName } from "../validators/user.validator.js";
import User from "../models/user.model.js";

// Validation Helper
const validateEmail = (email) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

const validatePassword = (password) => {
  const errors = [];
  if (password.length < 8) errors.push("Password must be at least 8 characters.");
  if (!/[A-Z]/.test(password)) errors.push("Password must contain at least one uppercase letter.");
  if (!/[a-z]/.test(password)) errors.push("Password must contain at least one lowercase letter.");
  if (!/[0-9]/.test(password)) errors.push("Password must contain at least one number.");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Password must contain at least one special character.");
  return errors;
};

// ========================================
// REGISTER
// ========================================

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    let errors = {};

    // Name Validation
    const nameError = validateName(name);
    if (nameError) {
      errors.name = nameError;
    }

    // Email Validation
    if (!email || email.trim().length === 0) {
      errors.email = "Email is required.";
    } else if (!validateEmail(email)) {
      errors.email = "Please enter a valid email address.";
    }

    // Password Validation
    if (!password) {
      errors.password = "Password is required.";
    } else {
      const pwdErrors = validatePassword(password);
      if (pwdErrors.length > 0) {
        errors.password = pwdErrors[0]; // Show the first failure
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.name || "Validation failed",
        errors
      });
    }

    const normalizedName = normalizeName(name);
    const user = await registerUser({ name: normalizedName, email: email.trim(), password });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {
    console.error("Registration error:", error);
    
    // Check if it's the "email exists" error from the service
    if (error.message && error.message.toLowerCase().includes("email already exists")) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: {
          email: "An account with this email already exists."
        }
      });
    }

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// ========================================
// LOGIN
// ========================================

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    let errors = {};

    if (!email || email.trim().length === 0) {
      errors.email = "Email is required.";
    } else if (!validateEmail(email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
      });
    }

    const result = await loginUser(email, password);

    // Set HTTP-only cookie with the token
    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: result.user,
      token: result.token,
    });

  } catch (error) {
    console.error("Login error:", error);
    
    // Convert generic unauthorized to structured or just send generic message
    return res.status(401).json({
      success: false,
      message: error.message || "Invalid email or password",
    });
  }
};


// ========================================
// VERIFY OTP
// ========================================

const verifyOtpController = async (req, res) => {
  try {
    const { email, otp } = req.body;
    let errors = {};

    if (!email) {
      errors.email = "Email is required.";
    }
    
    if (!otp) {
      errors.otp = "OTP is required.";
    } else if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      errors.otp = "Please enter a valid 6-digit OTP.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
      });
    }

    const user = await verifyOtp(email, otp);

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      user,
    });

  } catch (error) {
    console.error("OTP verification error:", error.message);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// ========================================
// RESEND OTP
// ========================================

const resendOtpController = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    await resendOtp(email);

    res.status(200).json({
      success: true,
      message: "New OTP sent successfully",
    });
  } catch (error) {
    console.error("Resend OTP error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ========================================
// FORGOT PASSWORD
// ========================================

const forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    await forgotPassword(email);

    res.status(200).json({
      success: true,
      message: "If an account exists for this email, a password reset link has been sent.",
    });

  } catch (error) {
    console.error("Forgot password error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to process password reset request",
    });
  }
};


// ========================================
// RESET PASSWORD
// ========================================

const resetPasswordController = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    const pwdErrors = validatePassword(password);
    if (pwdErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: pwdErrors[0],
      });
    }

    await resetPassword(token, password);

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });

  } catch (error) {
    console.error("Reset password error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ========================================
// LOGOUT
// ========================================

const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to process logout",
    });
  }
};

// ========================================
// CHECK SESSION
// ========================================

const checkSession = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    if (user.googleId && user.authProvider !== "google") {
      user.authProvider = "google";
      await user.save();
    }

    const isGoogleUser = user.authProvider === "google" || Boolean(user.googleId);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        profileImage: user.profileImage || "",
        authProvider: isGoogleUser ? "google" : (user.authProvider || "local"),
        googleId: user.googleId || null,
      }
    });
  } catch (error) {
    console.error("Check session error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid session",
    });
  }
};

// ========================================
// GOOGLE LOGIN CONTROLLER
// ========================================

const googleLoginController = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
    }

    const result = await googleLoginUser(credential);

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Google login successful",
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(401).json({
      success: false,
      message: error.message || "Google authentication failed",
    });
  }
};

export {
  register,
  login,
  verifyOtpController,
  resendOtpController,
  forgotPasswordController,
  resetPasswordController,
  logout,
  checkSession,
  googleLoginController,
};

export default {
  register,
  login,
  verifyOtpController,
  resendOtpController,
  forgotPasswordController,
  resetPasswordController,
  logout,
  checkSession,
  googleLoginController,
};