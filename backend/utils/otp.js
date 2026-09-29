const crypto = require("crypto");

const generateOtp = () => {
  return crypto
    .randomInt(100000, 1000000)
    .toString();
};

const hashOtp = (otp) => {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(otp)
    .digest("hex");
};

module.exports = {
  generateOtp,
  hashOtp,
};