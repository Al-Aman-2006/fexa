import axiosInstance from "../api/axiosInstance.js";

/**
 * Auth Service
 * Handles user authentication, registration, session checks, OTP verification, and password resets.
 */

export const login = async (credentials) => {
  const response = await axiosInstance.post("/api/auth/login", credentials);
  return response.data;
};

export const googleLogin = async (credential) => {
  const response = await axiosInstance.post("/api/auth/google", { credential });
  return response.data;
};

export const register = async (userData) => {
  const response = await axiosInstance.post("/api/auth/register", userData);
  return response.data;
};

export const logout = async () => {
  const response = await axiosInstance.post("/api/auth/logout");
  return response.data;
};

export const checkSession = async () => {
  const response = await axiosInstance.get("/api/auth/session");
  return response.data;
};

export const verifyOtp = async (email, otp) => {
  const response = await axiosInstance.post("/api/auth/verify-otp", { email, otp });
  return response.data;
};

export const resendOtp = async (email) => {
  const response = await axiosInstance.post("/api/auth/resend-otp", { email });
  return response.data;
};

export const forgotPassword = async (email) => {
  const response = await axiosInstance.post("/api/auth/forgot-password", { email });
  return response.data;
};

export const resetPassword = async (token, password) => {
  const response = await axiosInstance.post(`/api/auth/reset-password/${token}`, { password });
  return response.data;
};

export const authService = {
  login,
  googleLogin,
  register,
  logout,
  checkSession,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
};

export default authService;
