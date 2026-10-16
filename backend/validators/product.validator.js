/**
 * Backend Product & Variant Validator for FEXA
 */

// Category normalization and validation
const normalizeCategory = (category) => {
  if (!category || typeof category !== "string") return "";
  const trimmed = category.trim().toLowerCase();
  if (trimmed === "men") return "Men";
  if (trimmed === "women") return "Women";
  if (trimmed === "unisex") return "Unisex";
  return category.trim();
};

const validateCategory = (value) => {
  if (!value || typeof value !== "string") {
    return "Please select a valid category (Men, Women, or Unisex).";
  }
  const normalized = normalizeCategory(value);
  if (!["Men", "Women", "Unisex"].includes(normalized)) {
    return "Please select a valid category (Men, Women, or Unisex).";
  }
  return null;
};

const validateProductName = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "Product name is required.";
  if (trimmed.length < 2) return "Product name must be at least 2 characters.";
  if (trimmed.length > 100) return "Product name cannot exceed 100 characters.";
  if (
    /<[a-z][\s\S]*>/i.test(trimmed) ||
    /<\/?script/i.test(trimmed) ||
    /javascript:/i.test(trimmed) ||
    /&lt;[\s\S]*&gt;/i.test(trimmed)
  ) {
    return "Product name cannot contain HTML or script tags.";
  }
  if (!/[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed)) {
    return "Product name must contain letters or numbers.";
  }
  return null;
};

const validateBrand = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "Brand is required.";
  if (trimmed.length < 2) return "Brand must be at least 2 characters.";
  if (trimmed.length > 100) return "Brand cannot exceed 100 characters.";
  if (
    /<[a-z][\s\S]*>/i.test(trimmed) ||
    /<\/?script/i.test(trimmed) ||
    /javascript:/i.test(trimmed) ||
    /&lt;[\s\S]*&gt;/i.test(trimmed)
  ) {
    return "Brand cannot contain HTML or script tags.";
  }
  if (!/[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed)) {
    return "Brand must contain letters or numbers.";
  }
  return null;
};

const validatePrice = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return "Price is required.";
  }
  const str = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(str)) {
    if (str.startsWith("-")) {
      return "Price cannot be negative.";
    }
    return "Price must be a valid positive number.";
  }
  const num = Number(str);
  if (isNaN(num) || !isFinite(num) || num <= 0) {
    return "Price must be greater than zero.";
  }
  if (str.includes(".") && str.split(".")[1].length > 2) {
    return "Price cannot have more than 2 decimal places.";
  }
  if (num > 10000000) {
    return "Price cannot exceed 10,000,000.";
  }
  return null;
};

const validateCompareAtPrice = (value, sellingPrice) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null; // Optional
  }
  const str = String(value).trim();
  if (str === "" || str === "0") {
    return null;
  }
  if (!/^\d+(\.\d+)?$/.test(str)) {
    if (str.startsWith("-")) {
      return "Original price (MRP) cannot be negative.";
    }
    return "Original price must be a valid number.";
  }
  const num = Number(str);
  if (isNaN(num) || !isFinite(num) || num <= 0) {
    return "Original price (MRP) must be greater than zero.";
  }
  if (str.includes(".") && str.split(".")[1].length > 2) {
    return "Original price cannot have more than 2 decimal places.";
  }
  if (num > 10000000) {
    return "Original price cannot exceed 10,000,000.";
  }

  if (sellingPrice !== undefined && sellingPrice !== null && String(sellingPrice).trim() !== "") {
    const sellNum = Number(String(sellingPrice).trim());
    if (!isNaN(sellNum) && sellNum > 0 && num < sellNum) {
      return "Original price (MRP) cannot be less than the selling price.";
    }
  }

  return null;
};

const validateStock = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return "Stock quantity is required.";
  }
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) {
    if (str.includes(".")) {
      return "Stock must be a whole number (no decimals).";
    }
    if (str.startsWith("-")) {
      return "Stock cannot be negative.";
    }
    return "Stock must be a valid non-negative whole number.";
  }
  const num = Number(str);
  if (isNaN(num) || !Number.isInteger(num) || num < 0) {
    return "Stock cannot be negative.";
  }
  if (num > 1000000) {
    return "Stock quantity cannot exceed 1,000,000.";
  }
  return null;
};

const validateDescription = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "Product description is required.";
  if (trimmed.length < 10) return "Product description must be at least 10 characters.";
  if (trimmed.length > 2000) return "Product description cannot exceed 2000 characters.";
  if (
    /<[a-z][\s\S]*>/i.test(trimmed) ||
    /<\/?script/i.test(trimmed) ||
    /javascript:/i.test(trimmed) ||
    /&lt;[\s\S]*&gt;/i.test(trimmed)
  ) {
    return "Description cannot contain HTML or script tags.";
  }
  return null;
};

const validateStatus = (value) => {
  if (value) {
    const trimmed = String(value).trim();
    if (!["Active", "Inactive", "Out of Stock"].includes(trimmed)) {
      return "Status must be Active, Inactive, or Out of Stock.";
    }
  }
  return null;
};

// ========================================
// PERFUME SIZE & VARIANT VALIDATION
// ========================================

const validateVolumeMl = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return "Perfume volume is required.";
  }
  const str = String(value).trim();
  const num = Number(str);
  if (isNaN(num) || !isFinite(num) || num <= 0) {
    return "Volume must be a positive number in ml.";
  }
  if (!Number.isInteger(num)) {
    return "Volume in ml must be a whole integer (e.g., 30, 50, 100).";
  }
  if (num > 5000) {
    return "Volume cannot exceed 5,000 ml.";
  }
  return null;
};

const validateVariantItem = (variant, index, allVariants = []) => {
  const errors = {};

  const volumeError = validateVolumeMl(variant.volumeMl);
  if (volumeError) {
    errors.volumeMl = volumeError;
  } else {
    // Check duplicate volumes
    const currentVol = Number(variant.volumeMl);
    const duplicates = allVariants.filter(
      (v, idx) => idx !== index && Number(v.volumeMl) === currentVol
    );
    if (duplicates.length > 0) {
      errors.volumeMl = `Duplicate size: ${currentVol} ml already exists for this perfume.`;
    }
  }

  const priceError = validatePrice(variant.sellingPrice);
  if (priceError) {
    errors.sellingPrice = priceError;
  }

  const mrpError = validateCompareAtPrice(variant.originalPrice, variant.sellingPrice);
  if (mrpError) {
    errors.originalPrice = mrpError;
  }

  const stockError = validateStock(variant.stock);
  if (stockError) {
    errors.stock = stockError;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateVariants = (variants = []) => {
  const errors = {};
  const variantErrors = [];

  if (!Array.isArray(variants) || variants.length === 0) {
    errors.variants = "Every perfume must have at least one size variant (e.g. 50 ml, 100 ml).";
    return { isValid: false, errors, variantErrors };
  }

  const seenVolumes = new Set();
  let hasDuplicate = false;
  let hasPurchasableSize = false;

  variants.forEach((v, idx) => {
    const itemValidation = validateVariantItem(v, idx, variants);
    variantErrors[idx] = itemValidation.errors;

    const vol = Number(v.volumeMl);
    if (!isNaN(vol) && vol > 0) {
      if (seenVolumes.has(vol)) {
        hasDuplicate = true;
      }
      seenVolumes.add(vol);
    }

    if (v.isAvailable !== false) {
      hasPurchasableSize = true;
    }
  });

  if (hasDuplicate) {
    errors.variants = "Duplicate perfume sizes detected. Each volume (in ml) must be unique.";
  } else if (!hasPurchasableSize) {
    errors.variants = "At least one size option must be marked available for purchase.";
  }

  const hasAnyItemError = variantErrors.some((err) => Object.keys(err).length > 0);

  return {
    isValid: Object.keys(errors).length === 0 && !hasAnyItemError,
    errors,
    variantErrors,
  };
};

// ========================================
// COMBINED PRODUCT VALIDATION
// ========================================

const validateProduct = (data = {}, options = {}) => {
  const {
    isEdit = false,
    imageCount = 0,
    newFilesCount,
    existingImagesCount = 0,
    files = [],
  } = options;

  const errors = {};
  const sanitized = {};

  // Name
  const nameErr = validateProductName(data.name);
  if (nameErr) errors.name = nameErr;
  else sanitized.name = data.name.trim();

  // Brand
  const brandErr = validateBrand(data.brand || "FEXA");
  if (brandErr) errors.brand = brandErr;
  else sanitized.brand = (data.brand || "FEXA").trim();

  // Category
  const catErr = validateCategory(data.category);
  if (catErr) errors.category = catErr;
  else sanitized.category = normalizeCategory(data.category);

  // Description
  const descErr = validateDescription(data.description);
  if (descErr) errors.description = descErr;
  else sanitized.description = data.description.trim();

  // Status
  const statusErr = validateStatus(data.status);
  if (statusErr) errors.status = statusErr;
  else sanitized.status = data.status ? data.status.trim() : "Active";

  // Check if variants are present
  const hasVariants = Array.isArray(data.variants) && data.variants.length > 0;

  if (hasVariants) {
    const variantsResult = validateVariants(data.variants);
    if (!variantsResult.isValid) {
      if (variantsResult.errors.variants) {
        errors.variants = variantsResult.errors.variants;
      }
      errors.variantItems = variantsResult.variantErrors;
    } else {
      sanitized.variants = data.variants.map((v) => ({
        _id: v._id,
        volumeMl: Number(v.volumeMl),
        sellingPrice: Number(v.sellingPrice),
        originalPrice: v.originalPrice !== undefined && v.originalPrice !== null && v.originalPrice !== ""
          ? Number(v.originalPrice)
          : null,
        stock: Number(v.stock),
        isAvailable: v.isAvailable !== false,
      }));

      // Calculate aggregated price, compareAtPrice, and stock
      const purchasable = sanitized.variants.filter((v) => v.isAvailable);
      const activeList = purchasable.length > 0 ? purchasable : sanitized.variants;
      sanitized.price = Math.min(...activeList.map((v) => v.sellingPrice));
      const firstWithCompare = activeList.find((v) => v.originalPrice);
      sanitized.compareAtPrice = firstWithCompare ? firstWithCompare.originalPrice : null;
      sanitized.stock = sanitized.variants.reduce((acc, v) => acc + (v.stock || 0), 0);
    }
  } else {
    // Top-level price & stock validation for non-variant/legacy payloads
    const priceErr = validatePrice(data.price);
    if (priceErr) errors.price = priceErr;
    else sanitized.price = Number(data.price);

    const mrpErr = validateCompareAtPrice(data.compareAtPrice, data.price);
    if (mrpErr) errors.compareAtPrice = mrpErr;
    else if (data.compareAtPrice) sanitized.compareAtPrice = Number(data.compareAtPrice);

    const stockErr = validateStock(data.stock);
    if (stockErr) errors.stock = stockErr;
    else sanitized.stock = Number(data.stock);
  }

  // File and Image count checks
  const totalCount =
    (newFilesCount !== undefined ? newFilesCount : imageCount) + existingImagesCount;

  if (!isEdit && totalCount === 0) {
    errors.images = "Please upload at least one product image.";
  } else if (isEdit && totalCount === 0) {
    errors.images = "A product must have at least one image. Please keep an existing image or upload a new one.";
  } else if (totalCount > 5) {
    errors.images = "Maximum 5 product images allowed.";
  }

  // Check file types and sizes if files are passed
  if (files && files.length > 0) {
    const allowedMime = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    for (const file of files) {
      if (file.mimetype && !allowedMime.includes(file.mimetype.toLowerCase())) {
        errors.images = "Invalid file format. Only JPG, JPEG, PNG, and WEBP images are supported.";
        break;
      }
      if (file.size && file.size > 5 * 1024 * 1024) {
        errors.images = "Image file size exceeds maximum limit of 5MB.";
        break;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  };
};

module.exports = {
  normalizeCategory,
  validateCategory,
  validateProductName,
  validateBrand,
  validatePrice,
  validateCompareAtPrice,
  validateStock,
  validateDescription,
  validateStatus,
  validateVolumeMl,
  validateVariantItem,
  validateVariants,
  validateProduct,
};
