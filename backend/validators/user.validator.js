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

module.exports = {
  normalizeName,
  validateName,
};
