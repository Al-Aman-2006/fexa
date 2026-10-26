import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "../uploads/products");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const filename = `product-${uniqueSuffix}${extension}`;
    cb(null, filename);
  },
});

// File Filter
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
        "Only JPG, JPEG, PNG, and WEBP images are allowed."
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Middleware wrapper to handle errors gracefully
const handleProductUpload = (req, res, next) => {
  const multerUpload = upload.array("images", 5);

  multerUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Image size is too large. Maximum size per image is 5MB.",
          errors: { images: "Each image must be 5MB or smaller." },
        });
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          success: false,
          message: "Maximum 5 images are allowed per product.",
          errors: { images: "Maximum 5 images are allowed per product." },
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message,
        errors: { images: err.message },
      });
    } else if (err) {
      const errMsg = err.message || "Invalid image upload.";
      return res.status(400).json({
        success: false,
        message: errMsg,
        errors: { images: errMsg },
      });
    }
    next();
  });
};

export default handleProductUpload;
