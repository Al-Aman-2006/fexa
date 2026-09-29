const crypto = require("crypto");

// ========================================
// GENERATE RESET TOKEN
// ========================================

const generateResetToken = () => {
  return crypto.randomBytes(32).toString("hex");
};


// ========================================
// HASH RESET TOKEN
// ========================================

const hashResetToken = (token) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};


module.exports = {
  generateResetToken,
  hashResetToken,
};