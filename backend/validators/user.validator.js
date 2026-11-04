/**
 * User Validation Module (Backend)
 * Enforces human name validation for Registration and Profile updates.
 */

const normalizeName = (name) => {
  if (typeof name !== "string") return "";
  return name.trim().replace(/\s+/g, " ");
};

const validateName = (value) => {
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

  // 3b. Reject consecutive whitespace
  if (/\s{2,}/.test(trimmed)) {
    return "Name cannot contain consecutive spaces.";
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

const normalizeEmail = (email) => {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
};

const validateEmail = (value) => {
  if (value === undefined || value === null) {
    return "Email address is required.";
  }

  if (typeof value !== "string") {
    return "Please enter a valid email address.";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "Email address is required.";
  }

  if (/\s/.test(trimmed)) {
    return "Email address cannot contain spaces.";
  }

  if (trimmed.length > 254) {
    return "Email address cannot exceed 254 characters.";
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(trimmed)) {
    return "Please enter a valid email address.";
  }

  const parts = trimmed.split("@");
  if (parts.length !== 2) return "Please enter a valid email address.";
  const domain = parts[1];
  const domainParts = domain.split(".");
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
    return "Please enter a valid email address.";
  }

  return null;
};

const validateProfilePhone = (value, { isRequired = false } = {}) => {
  if (value === undefined || value === null) {
    if (isRequired) return "Phone number is required.";
    return null;
  }

  if (typeof value !== "string") {
    return "Please enter a valid phone number.";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    if (isRequired) return "Phone number is required.";
    return null;
  }

  if (/[a-zA-Z]/.test(trimmed)) {
    return "Phone number cannot contain letters.";
  }

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (!digitsOnly || digitsOnly.length === 0) {
    return "Please enter a valid phone number.";
  }

  if (!/^[\d\s+\-()]+$/.test(trimmed)) {
    return "Phone number contains invalid characters.";
  }

  if (digitsOnly.length < 7) {
    return "Phone number must have at least 7 digits.";
  }
  if (digitsOnly.length > 15) {
    return "Phone number cannot exceed 15 digits.";
  }

  if (trimmed.startsWith("+91") || (trimmed.startsWith("91") && digitsOnly.length === 12)) {
    const indianDigits = digitsOnly.startsWith("91") ? digitsOnly.slice(2) : digitsOnly;
    if (indianDigits.length !== 10) {
      return "Indian mobile numbers must be 10 digits.";
    }
    if (!/^[6-9]/.test(indianDigits)) {
      return "Indian mobile numbers must start with 6, 7, 8, or 9.";
    }
    if (/^(\d)\1{9}$/.test(indianDigits)) {
      return "Please enter a valid mobile number (repeated digits not allowed).";
    }
  } else if (digitsOnly.length === 10) {
    if (/^(\d)\1{9}$/.test(digitsOnly)) {
      return "Please enter a valid phone number (repeated digits not allowed).";
    }
    if (/^[0-5]/.test(digitsOnly)) {
      return "10-digit mobile numbers must start with 6, 7, 8, or 9.";
    }
  } else {
    if (/^(\d)\1{6,}$/.test(digitsOnly)) {
      return "Please enter a valid phone number (repeated digits not allowed).";
    }
  }

  return null;
};

export {
  normalizeName,
  validateName,
  normalizeEmail,
  validateEmail,
  validateProfilePhone,
};

export default {
  normalizeName,
  validateName,
  normalizeEmail,
  validateEmail,
  validateProfilePhone,
};
