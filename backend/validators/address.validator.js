/**
 * Address Validation Module (Backend)
 * Enforces strict validation for user delivery addresses.
 */

const normalizePhone = (phone) => {
  if (!phone) return "";
  return phone.toString().trim().replace(/[\s\-()]/g, "");
};

const validateFullName = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "Full name is required.";
  if (trimmed.length < 2) return "Full name must be at least 2 characters.";
  if (trimmed.length > 100) return "Full name cannot exceed 100 characters.";
  if (/\d/.test(trimmed)) return "Full name cannot contain numbers.";
  
  // Allow letters (including international accented letters), spaces, hyphens, and apostrophes
  if (!/^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s'-]+$/.test(trimmed)) {
    return "Full name can only contain letters, spaces, hyphens, and apostrophes.";
  }
  
  // Must contain at least 2 letters
  const letterCount = (trimmed.match(/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/g) || []).length;
  if (letterCount < 2) {
    return "Full name must contain at least 2 letters.";
  }
  
  return null;
};

const validatePhone = (value, country = "India") => {
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

    // Reject phone numbers with 10 identical digits (e.g. 9999999999)
    if (/^(\d)\1{9}$/.test(digits)) {
      return "Please enter a valid mobile number (repeated digits not allowed).";
    }
  } else {
    // International phone number validation: 7 to 15 digits (E.164 standard)
    if (!/^\+?[1-9]\d{6,14}$/.test(normalized)) {
      return "Please enter a valid phone number (7 to 15 digits).";
    }
    if (/^(\+?\d)\1{6,}$/.test(normalized)) {
      return "Please enter a valid phone number.";
    }
  }

  return null;
};

const validateHouse = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "House / Building name or number is required.";
  if (trimmed.length < 2) return "House / Building must be at least 2 characters.";
  if (trimmed.length > 100) return "House / Building cannot exceed 100 characters.";
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return "House / Building cannot contain only punctuation.";
  }
  return null;
};

const validateStreet = (value) => {
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

const validateCity = (value) => {
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

const validateState = (value) => {
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

const validatePincode = (value, country = "India") => {
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

const validateCountry = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "Country is required.";
  if (trimmed.length < 2) return "Country must be at least 2 characters.";
  if (trimmed.length > 100) return "Country cannot exceed 100 characters.";
  if (!/[a-zA-Z]/.test(trimmed)) return "Country must contain letters.";
  return null;
};

const validateLabel = (value) => {
  const trimmed = (value || "Home").trim();
  const allowed = ["Home", "Work", "Other"];
  if (!allowed.includes(trimmed)) {
    return "Please select a valid address type (Home, Work, or Other).";
  }
  return null;
};

/**
 * Validate an address payload.
 * Returns { isValid, errors, normalizedData }
 */
const validateAddress = (data = {}) => {
  const errors = {};

  const country = (data.country || "India").trim();

  const nameError = validateFullName(data.fullName);
  if (nameError) errors.fullName = nameError;

  const phoneError = validatePhone(data.phone, country);
  if (phoneError) errors.phone = phoneError;

  const houseError = validateHouse(data.house);
  if (houseError) errors.house = houseError;

  const streetError = validateStreet(data.street);
  if (streetError) errors.street = streetError;

  const cityError = validateCity(data.city);
  if (cityError) errors.city = cityError;

  const stateError = validateState(data.state);
  if (stateError) errors.state = stateError;

  const pincodeError = validatePincode(data.pincode, country);
  if (pincodeError) errors.pincode = pincodeError;

  const countryError = validateCountry(data.country);
  if (countryError) errors.country = countryError;

  const labelError = validateLabel(data.label);
  if (labelError) errors.label = labelError;

  // Normalize phone for storage
  let normalizedPhone = normalizePhone(data.phone);
  if (country.toLowerCase() === "india") {
    if (normalizedPhone.startsWith("+91")) {
      normalizedPhone = normalizedPhone.slice(3);
    } else if (normalizedPhone.startsWith("91") && normalizedPhone.length === 12) {
      normalizedPhone = normalizedPhone.slice(2);
    }
  }

  const normalizedData = {
    label: (data.label || "Home").trim(),
    fullName: (data.fullName || "").trim(),
    phone: normalizedPhone,
    house: (data.house || "").trim(),
    street: (data.street || "").trim(),
    city: (data.city || "").trim(),
    state: (data.state || "").trim(),
    pincode: (data.pincode || "").trim().replace(/\s+/g, ""),
    country: country || "India",
    isDefault: Boolean(data.isDefault),
  };

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    normalizedData,
  };
};

module.exports = {
  validateAddress,
  validateFullName,
  validatePhone,
  validateHouse,
  validateStreet,
  validateCity,
  validateState,
  validatePincode,
  validateCountry,
  validateLabel,
  normalizePhone,
};
