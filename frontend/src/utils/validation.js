/**
 * Frontend Validation Utility for FEXA
 * Handles real-time, blur, and submit validation for:
 * 1. User Profile Address (Add / Edit)
 * 2. Admin Product Management (Add / Edit)
 */

// ============================================================================
// USER NAME VALIDATION HELPERS (REGISTRATION & PROFILE)
// ============================================================================

export const normalizeName = (name) => {
  if (typeof name !== "string") return "";
  return name.trim().replace(/\s+/g, " ");
};

export const validateName = (value) => {
  if (value === undefined || value === null) {
    return "Name is required.";
  }

  if (typeof value !== "string") {
    return "Please enter a valid name using letters.";
  }

  const trimmed = value.trim();

  // 1. Required / Empty / Whitespace-only
  if (!trimmed) {
    return "Name is required.";
  }

  // 2. Length constraints
  if (trimmed.length < 2) {
    return "Name must be at least 2 characters.";
  }

  if (trimmed.length > 100) {
    return "Name cannot exceed 100 characters.";
  }

  // 3. Reject numbers (entirely or partially)
  if (/\d/.test(trimmed)) {
    return "Please enter a valid name using letters.";
  }

  // 4. Allowed characters check:
  // Must only contain letters (including international/accented Unicode letters),
  // spaces, hyphens, apostrophes (' and ’), and periods (.)
  if (!/^[\p{L}\s'\-.’]+$/u.test(trimmed)) {
    return "Please enter a valid name using letters.";
  }

  // 5. Must contain at least 2 letters
  const letterCount = (trimmed.match(/\p{L}/gu) || []).length;
  if (letterCount < 2) {
    return "Please enter a valid name using letters.";
  }

  // 6. Reject repeated punctuation (e.g. --, .., '', ’’, .-, -.)
  if (/[-'.’]{2,}/u.test(trimmed)) {
    return "Please enter a valid name using letters.";
  }

  // 7. Human name format validation:
  // Split into words by whitespace.
  // Each word:
  // - Must start with a letter (\p{L})
  // - May have internal hyphens or apostrophes between letters (e.g. Anne-Marie, O'Connor)
  // - May end with a period for abbreviations/initials (e.g. St., Jr., J.)
  const words = trimmed.split(/\s+/);
  const wordPattern = /^\p{L}+(?:['’\-]\p{L}+)*\.?$/u;

  for (const word of words) {
    if (!wordPattern.test(word)) {
      return "Please enter a valid name using letters.";
    }
  }

  return null;
};

// ============================================================================
// ADDRESS VALIDATION HELPERS
// ============================================================================

export const normalizePhone = (phone) => {
  if (!phone) return "";
  return phone.toString().trim().replace(/[\s\-()]/g, "");
};

export const validateFullName = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "Full name is required.";
  if (trimmed.length < 2) return "Full name must be at least 2 characters.";
  if (trimmed.length > 100) return "Full name cannot exceed 100 characters.";
  if (/\d/.test(trimmed)) return "Full name cannot contain numbers.";
  
  if (!/^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s'-]+$/.test(trimmed)) {
    return "Full name can only contain letters, spaces, hyphens, and apostrophes.";
  }
  
  const letterCount = (trimmed.match(/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/g) || []).length;
  if (letterCount < 2) {
    return "Full name must contain at least 2 letters.";
  }
  
  return null;
};

export const validatePhone = (value, country = "India") => {
  const raw = (value || "").trim();
  if (!raw) return "Phone number is required.";
  
  if (/[a-zA-Z]/.test(raw)) return "Phone number cannot contain letters.";
  
  const normalized = normalizePhone(raw);
  const isIndia = !country || country.trim().toLowerCase() === "india";

  if (isIndia) {
    let digits = normalized;
    if (digits.startsWith("+91")) {
      digits = digits.slice(3);
    } else if (digits.startsWith("91") && digits.length === 12) {
      digits = digits.slice(2);
    }

    if (!/^\d{10}$/.test(digits)) {
      return "Please enter a valid 10-digit Indian mobile number.";
    }

    if (!/^[6-9]/.test(digits)) {
      return "Indian mobile numbers must start with 6, 7, 8, or 9.";
    }

    if (/^(\d)\1{9}$/.test(digits)) {
      return "Please enter a valid mobile number (repeated digits not allowed).";
    }
  } else {
    if (!/^\+?[1-9]\d{6,14}$/.test(normalized)) {
      return "Please enter a valid phone number (7 to 15 digits).";
    }
    if (/^(\+?\d)\1{6,}$/.test(normalized)) {
      return "Please enter a valid phone number.";
    }
  }

  return null;
};

export const validateHouse = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "House / Building is required.";
  if (trimmed.length < 2) return "House / Building must be at least 2 characters.";
  if (trimmed.length > 100) return "House / Building cannot exceed 100 characters.";
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return "House / Building cannot contain only punctuation.";
  }
  return null;
};

export const validateStreet = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "Street address is required.";
  if (trimmed.length < 5) return "Street address must be at least 5 characters.";
  if (trimmed.length > 200) return "Street address cannot exceed 200 characters.";
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return "Street address cannot contain only punctuation.";
  }
  if (!/^[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s,.\-#/&'’]+$/.test(trimmed)) {
    return "Street address contains invalid characters.";
  }
  return null;
};

export const validateCity = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "City is required.";
  if (trimmed.length < 2) return "City must be at least 2 characters.";
  if (trimmed.length > 100) return "City cannot exceed 100 characters.";
  if (/^\d+$/.test(trimmed)) return "City cannot contain only numbers.";
  if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed)) {
    return "City must contain letters.";
  }
  if (!/^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s.'-]+$/.test(trimmed)) {
    return "City contains invalid characters.";
  }
  return null;
};

export const validateState = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "State is required.";
  if (trimmed.length < 2) return "State must be at least 2 characters.";
  if (trimmed.length > 100) return "State cannot exceed 100 characters.";
  if (/^\d+$/.test(trimmed)) return "State cannot contain only numbers.";
  if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed)) {
    return "State must contain letters.";
  }
  if (!/^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s.'-]+$/.test(trimmed)) {
    return "State contains invalid characters.";
  }
  return null;
};

export const validatePincode = (value, country = "India") => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "PIN code is required.";
  
  const normalized = trimmed.replace(/\s+/g, "");
  const isIndia = !country || country.trim().toLowerCase() === "india";

  if (isIndia) {
    if (/[a-zA-Z]/.test(normalized)) {
      return "PIN code cannot contain letters.";
    }
    if (!/^[1-9][0-9]{5}$/.test(normalized)) {
      return "Please enter a valid 6-digit Indian PIN code.";
    }
  } else {
    if (!/^[a-zA-Z0-9-]{3,10}$/.test(normalized)) {
      return "Please enter a valid postal code (3-10 alphanumeric characters).";
    }
  }

  return null;
};

export const validateCountry = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "Country is required.";
  if (trimmed.length < 2) return "Country must be at least 2 characters.";
  if (trimmed.length > 100) return "Country cannot exceed 100 characters.";
  if (!/[a-zA-Z]/.test(trimmed)) return "Country must contain letters.";
  return null;
};

export const validateLabel = (value) => {
  const trimmed = (value || "Home").trim();
  const allowed = ["Home", "Work", "Other"];
  if (!allowed.includes(trimmed)) {
    return "Please select a valid address type (Home, Work, or Other).";
  }
  return null;
};

export const validateAddressField = (name, value, allValues = {}) => {
  const country = allValues.country || "India";
  switch (name) {
    case "fullName":
      return validateFullName(value);
    case "phone":
      return validatePhone(value, country);
    case "house":
      return validateHouse(value);
    case "street":
      return validateStreet(value);
    case "city":
      return validateCity(value);
    case "state":
      return validateState(value);
    case "pincode":
      return validatePincode(value, country);
    case "country":
      return validateCountry(value);
    case "label":
      return validateLabel(value);
    default:
      return null;
  }
};

export const validateAddressForm = (formData = {}) => {
  const errors = {};
  const country = formData.country || "India";

  const fields = ["fullName", "phone", "house", "street", "city", "state", "pincode", "country", "label"];
  for (const field of fields) {
    const error = validateAddressField(field, formData[field], formData);
    if (error) {
      errors[field] = error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ============================================================================
// PRODUCT VALIDATION HELPERS
// ============================================================================

export const validateProductName = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "Product name is required.";
  if (trimmed.length < 2) return "Product name must be at least 2 characters.";
  if (trimmed.length > 150) return "Product name cannot exceed 150 characters.";
  if (
    /<[a-z][\s\S]*>/i.test(trimmed) ||
    /<\/?script/i.test(trimmed) ||
    /javascript:/i.test(trimmed) ||
    /&lt;[\s\S]*&gt;/i.test(trimmed)
  ) {
    return "Product name cannot contain HTML or script tags.";
  }
  const productNameRegex = /[\p{L}]/u;
  if (!productNameRegex.test(trimmed)) {
    return "Product name must contain at least one letter and cannot consist only of numbers or symbols.";
  }
  return null;
};

export const validateBrand = (value) => {
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
    return "Brand cannot consist solely of symbols or special characters. Please include letters or numbers.";
  }
  return null;
};

export const validateCategory = (value) => {
  const trimmed = (value || "").trim();
  if (!["Men", "Women", "Unisex"].includes(trimmed)) {
    return "Please select a valid category (Men, Women, or Unisex).";
  }
  return null;
};

export const validatePrice = (value) => {
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

export const validateCompareAtPrice = (value, sellingPrice) => {
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

export const validateStock = (value) => {
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

export const validateDescription = (value) => {
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

export const validateStatus = (value) => {
  if (value) {
    const trimmed = String(value).trim();
    if (!["Active", "Inactive", "Out of Stock"].includes(trimmed)) {
      return "Status must be Active, Inactive, or Out of Stock.";
    }
  }
  return null;
};

export const validateVolumeMl = (value) => {
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

export const validateVariantItem = (variant, index, allVariants = []) => {
  const errors = {};

  const volumeError = validateVolumeMl(variant.volumeMl);
  if (volumeError) {
    errors.volumeMl = volumeError;
  } else {
    // Check for duplicate volumes
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

export const validateVariantsList = (variants = []) => {
  const errors = {};
  const variantErrors = [];

  if (!Array.isArray(variants) || variants.length === 0) {
    errors.variants = "Every perfume must have at least one size variant (e.g. 50 ml, 100 ml).";
    return { isValid: false, errors, variantErrors };
  }

  // Check duplicate volumes across entire list
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

export const validateProductField = (name, value, allValues = {}) => {
  switch (name) {
    case "name":
      return validateProductName(value);
    case "brand":
      return validateBrand(value);
    case "category":
      return validateCategory(value);
    case "price":
      return validatePrice(value);
    case "compareAtPrice":
      return validateCompareAtPrice(value, allValues.price);
    case "stock":
      return validateStock(value);
    case "description":
      return validateDescription(value);
    case "status":
      return validateStatus(value);
    default:
      return null;
  }
};

export const validateProductForm = (formData, options = {}) => {
  const { isEdit = false, existingImages = [], newImageFiles = [] } = options;
  const errors = {};

  const fields = ["name", "brand", "category", "description"];
  for (const field of fields) {
    const error = validateProductField(field, formData[field], formData);
    if (error) {
      errors[field] = error;
    }
  }

  // If variants provided, validate variants
  if (Array.isArray(formData.variants) && formData.variants.length > 0) {
    const variantsCheck = validateVariantsList(formData.variants);
    if (!variantsCheck.isValid) {
      if (variantsCheck.errors.variants) {
        errors.variants = variantsCheck.errors.variants;
      }
      errors.variantItems = variantsCheck.variantErrors;
    }
  } else {
    // If no variants provided, validate top-level price and stock
    const priceErr = validatePrice(formData.price);
    if (priceErr) errors.price = priceErr;

    const mrpErr = validateCompareAtPrice(formData.compareAtPrice, formData.price);
    if (mrpErr) errors.compareAtPrice = mrpErr;

    const stockErr = validateStock(formData.stock);
    if (stockErr) errors.stock = stockErr;
  }

  // Image validation
  const totalImages = existingImages.length + newImageFiles.length;
  if (!isEdit && totalImages === 0) {
    errors.images = "Please upload at least one product image.";
  } else if (isEdit && totalImages === 0) {
    errors.images = "A product must have at least one image. Please keep an existing image or upload a new one.";
  } else if (totalImages > 5) {
    errors.images = "Maximum 5 product images allowed.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
