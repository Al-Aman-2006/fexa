import crypto from "crypto";

// ========================================
// GENERATE RESET TOKEN
// ========================================

export const generateResetToken = () => {
  return crypto.randomBytes(32).toString("hex");
};


// ========================================
// HASH RESET TOKEN
// ========================================

export const hashResetToken = (token) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};

export default {
  generateResetToken,
  hashResetToken,
};