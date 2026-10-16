const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

// Authentication middleware
const authMiddleware = require("../middlewares/auth.middleware");

// Profile controller
const {
  getProfile,
  getAddresses,
  updateProfile,
  uploadProfileImage,
  addAddress,
  updateAddress,
  deleteAddress,
  verifyEmailChange,
  resendEmailChangeOtp,
} = require("../controllers/profile.controller");

const fs = require("fs");

const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ========================================
// MULTER CONFIGURATION
// ========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);

    const filename =
      `profile-${req.user.id}-${Date.now()}${extension}`;

    cb(null, filename);
  },
});

// ========================================
// FILE FILTER
// ========================================

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only JPG, JPEG, PNG and WEBP images are allowed"
      )
    );
  }
};

// ========================================
// UPLOAD MIDDLEWARE
// ========================================

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const handleMulterUpload = (req, res, next) => {
  upload.single("profileImage")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Profile image must be smaller than 5MB",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    next();
  });
};

// ========================================
// GET PROFILE
// ========================================

router.get(
  "/",
  authMiddleware,
  getProfile
);

// ========================================
// UPDATE PROFILE
// ========================================

router.put(
  "/",
  authMiddleware,
  updateProfile
);

// ========================================
// VERIFY EMAIL CHANGE
// ========================================

router.post(
  "/verify-email-change",
  authMiddleware,
  verifyEmailChange
);

// ========================================
// RESEND EMAIL CHANGE OTP
// ========================================

router.post(
  "/resend-email-change-otp",
  authMiddleware,
  resendEmailChangeOtp
);

// ========================================
// UPLOAD PROFILE IMAGE
// ========================================

router.post(
  "/upload-image",
  authMiddleware,
  handleMulterUpload,
  uploadProfileImage
);

// ========================================
// GET SAVED ADDRESSES
// ========================================

router.get(
  "/addresses",
  authMiddleware,
  getAddresses
);

// ========================================
// ADD ADDRESS
// ========================================

router.post(
  "/addresses",
  authMiddleware,
  addAddress
);

// ========================================
// UPDATE ADDRESS
// ========================================

router.put(
  "/addresses/:addressId",
  authMiddleware,
  updateAddress
);

// ========================================
// DELETE ADDRESS
// ========================================

router.delete(
  "/addresses/:addressId",
  authMiddleware,
  deleteAddress
);

module.exports = router;