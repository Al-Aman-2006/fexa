import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

// ========================================
// ADMIN AUTHORIZATION MIDDLEWARE
// ========================================

const adminMiddleware = async (req, res, next) => {
  try {
    let token;

    if (req.cookies && req.cookies.adminToken) {
      token = req.cookies.adminToken;
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Admin authorization token is required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Admin account not found",
      });
    }

    if (user.isBlocked) {
      res.clearCookie("adminToken");
      return res.status(403).json({
        success: false,
        message: "Your admin account has been blocked.",
      });
    }

    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    req.admin = user;
    next();
  } catch (error) {
    console.error("Admin middleware error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired admin session token",
    });
  }
};

export default adminMiddleware;
