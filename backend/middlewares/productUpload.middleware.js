import multer from "multer";

// Memory storage: store files in memory as Buffers (no local disk writes)
const storage = multer.memoryStorage();

// File Filter: strictly enforce JPG, JPEG, PNG, and WEBP
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
