import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

// ========================================
// AUTHENTICATION MIDDLEWARE
// ========================================

const authMiddleware = (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    let token;
    
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Store user information inside request
    req.user = decoded;

    // Check if user is blocked in DB
    User.findById(decoded.id)
      .select("isBlocked role")
      .then((user) => {
        if (!user) {
          res.clearCookie("token");
          return res.status(401).json({
            success: false,
            message: "User account no longer exists",
          });
        }

        if (user.isBlocked) {
          res.clearCookie("token");
          return res.status(403).json({
            success: false,
            message: "Your account has been blocked. Please contact the administrator.",
          });
        }

        next();
      })
      .catch((err) => {
        return res.status(501).json({
          success: false,
          message: "Internal authentication error",
        });
      });

  } catch (error) {
    console.error(
      "Authentication error:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export default authMiddleware;