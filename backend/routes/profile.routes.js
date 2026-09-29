const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

// Authentication middleware
const authMiddleware = require("../middlewares/auth.middleware");

// Profile controller
const {
  getProfile,
  updateProfile,
  uploadProfileImage,
  addAddress,
} = require("../controllers/profile.controller");

// ========================================
// MULTER CONFIGURATION
// ========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
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

  if (allowedTypes.includes(file.mimetype)) {
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
// UPLOAD PROFILE IMAGE
// ========================================

router.post(
  "/upload-image",
  authMiddleware,
  upload.single("profileImage"),
  uploadProfileImage
);

// ========================================
// ADD ADDRESS
// ========================================

router.post(
  "/addresses",
  authMiddleware,
  addAddress
);

module.exports = router;