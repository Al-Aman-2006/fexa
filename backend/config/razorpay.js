import Razorpay from "razorpay";

let instance = null;

export const getRazorpayInstance = () => {
  if (!instance) {
    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_TqUYTgZOU4T32M";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "vlYvPndeLZ07y6a3ovxB3aPp";

    if (!keyId || !keySecret) {
      console.warn("⚠️ Warning: Razorpay credentials are not fully configured in environment.");
    }

    instance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return instance;
};

export default {
  getRazorpayInstance,
};
