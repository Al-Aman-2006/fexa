const {
  registerUser,
  loginUser,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
} = require("../services/auth.service");

// ========================================
// REGISTER
// ========================================

const register = async (req, res) => {
  try {
    const user = await registerUser(req.body);

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
    const {
      email,
      password,
    } = req.body;

    const result = await loginUser(
      email,
      password
    );

    // Set HTTP-only cookie with the token
    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: result.user,
    });

  } catch (error) {
    console.error("Login error:", error);

    res.status(401).json({
      success: false,
      message: error.message,
    });
  }
};


// ========================================
// VERIFY OTP
// ========================================

const verifyOtpController = async (req, res) => {
  try {
    const {
      email,
      otp,
    } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const user = await verifyOtp(
      email,
      otp
    );

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      user,
    });

  } catch (error) {
    console.error(
      "OTP verification error:",
      error.message
    );

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
    console.error(
      "Resend OTP error:",
      error.message
    );

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ========================================
// FORGOT PASSWORD
// ========================================

const forgotPasswordController = async (req,res) => {

  try {

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    await forgotPassword(email);

    /*
      Always return the same message.

      Don't reveal whether the email exists.
    */

    res.status(200).json({
      success: true,
      message:
        "If an account exists for this email, a password reset link has been sent.",
    });

  } catch (error) {

    console.error(
      "Forgot password error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message:
        "Unable to process password reset request",
    });
  }
};


// ========================================
// RESET PASSWORD
// ========================================

const resetPasswordController = async (
  req,
  res
) => {

  try {

    const { token } = req.params;

    const {
      password,
    } = req.body;

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

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters",
      });
    }

    await resetPassword(
      token,
      password
    );

    res.status(200).json({
      success: true,
      message:
        "Password reset successfully",
    });

  } catch (error) {

    console.error(
      "Reset password error:",
      error.message
    );

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
    // If the middleware passed, req.user has the decoded token
    // We should ideally fetch the latest user info from DB, but for now we can just return what we have or fetch it
    const User = require("../models/user.model");
    const user = await User.findById(req.user.id).select("-password");
    
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage, // Add other necessary fields
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

module.exports = {
  register,
  login,
  verifyOtpController,
  resendOtpController,
  forgotPasswordController,
  resetPasswordController,
  logout,
  checkSession,
};