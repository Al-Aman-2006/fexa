import axiosInstance from "../api/axiosInstance.js";

/**
 * User Service
 * Handles user profile management, saved addresses, wallet balance/transaction history, and customer contact inquiries.
 */

// Profile Endpoints
export const getProfile = async () => {
  const response = await axiosInstance.get("/api/profile");
  return response.data;
};

export const updateProfile = async (profileData) => {
  const response = await axiosInstance.put("/api/profile", profileData);
  return response.data;
};

export const uploadProfileImage = async (formData) => {
  // Content-Type is handled automatically by axiosInstance interceptor for FormData
  const response = await axiosInstance.post("/api/profile/upload-image", formData);
  return response.data;
};

export const verifyEmailChange = async (payload) => {
  const response = await axiosInstance.post("/api/profile/verify-email-change", payload);
  return response.data;
};

export const resendEmailChangeOtp = async () => {
  const response = await axiosInstance.post("/api/profile/resend-email-change-otp");
  return response.data;
};

// Address Endpoints
export const getAddresses = async () => {
  const response = await axiosInstance.get("/api/profile/addresses");
  return response.data;
};

export const addAddress = async (addressData) => {
  const response = await axiosInstance.post("/api/profile/addresses", addressData);
  return response.data;
};

export const updateAddress = async (addressId, addressData) => {
  const response = await axiosInstance.put(`/api/profile/addresses/${addressId}`, addressData);
  return response.data;
};

export const deleteAddress = async (addressId) => {
  const response = await axiosInstance.delete(`/api/profile/addresses/${addressId}`);
  return response.data;
};

// Wallet Endpoints (Balance & Transactions)
// Note: Wallet top-up payment gateway integration is authoritatively managed in payment.service.js
export const getWalletBalance = async () => {
  const response = await axiosInstance.get("/api/wallet");
  return response.data;
};

export const getWalletTransactions = async (params = {}) => {
  const response = await axiosInstance.get("/api/wallet/transactions", { params });
  return response.data;
};

// Contact Endpoints
export const submitContact = async (contactData) => {
  const response = await axiosInstance.post("/api/contact", contactData);
  return response.data;
};

export const getContactReasons = async () => {
  const response = await axiosInstance.get("/api/contact/reasons");
  return response.data;
};

export const userService = {
  getProfile,
  updateProfile,
  uploadProfileImage,
  verifyEmailChange,
  resendEmailChangeOtp,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getWalletBalance,
  getWalletTransactions,
  submitContact,
  getContactReasons,
};

export default userService;
