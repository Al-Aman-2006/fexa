import axiosInstance from "../api/axiosInstance.js";

/**
 * Payment Service
 * Handles online payment gateway integration (Razorpay), payment failure tracking, order payment status checks, and coupon validation/application.
 */

// Razorpay Payment Endpoints
export const getRazorpayKey = async () => {
  const response = await axiosInstance.get("/api/orders/razorpay/key");
  return response.data;
};

export const createRazorpayOrder = async (orderPayload) => {
  const response = await axiosInstance.post("/api/orders/razorpay/create-order", orderPayload);
  return response.data;
};

export const verifyRazorpayPayment = async (paymentData) => {
  const response = await axiosInstance.post("/api/orders/razorpay/verify-payment", paymentData);
  return response.data;
};

export const recordPaymentFailure = async (failureData) => {
  const response = await axiosInstance.post("/api/orders/razorpay/payment-failed", failureData);
  return response.data;
};

export const checkOrderStatus = async (orderId) => {
  const response = await axiosInstance.get(`/api/orders/razorpay/check-status/${orderId}`);
  return response.data;
};

// Coupon Endpoints
export const getAvailableCoupons = async () => {
  const response = await axiosInstance.get("/api/coupons/available");
  return response.data;
};

export const applyCoupon = async (code, orderAmount = 0) => {
  const payload = typeof code === "object" ? code : { couponCode: code, code, orderAmount };
  const response = await axiosInstance.post("/api/coupons/apply", payload);
  return response.data;
};

export const removeCoupon = async () => {
  const response = await axiosInstance.post("/api/coupons/remove");
  return response.data;
};

// Wallet Top-Up Payments
export const createWalletTopUp = async (amount) => {
  const payload = typeof amount === "object" ? amount : { amount };
  const response = await axiosInstance.post("/api/wallet/topup/create-order", payload);
  return response.data;
};

export const verifyWalletTopUp = async (paymentData) => {
  const response = await axiosInstance.post("/api/wallet/topup/verify", paymentData);
  return response.data;
};

export const paymentService = {
  getRazorpayKey,
  createRazorpayOrder,
  verifyRazorpayPayment,
  recordPaymentFailure,
  checkOrderStatus,
  getAvailableCoupons,
  applyCoupon,
  removeCoupon,
  createWalletTopUp,
  verifyWalletTopUp,
};

export default paymentService;
