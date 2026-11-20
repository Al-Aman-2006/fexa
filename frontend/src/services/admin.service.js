import axiosInstance from "../api/axiosInstance.js";

/**
 * Admin Service
 * Comprehensive administrative API client covering:
 * - Admin Authentication & Session
 * - User Management
 * - Product Management (including multipart image uploads)
 * - Category Management
 * - Order Processing & Status Updates
 * - Return & Refund Processing
 * - Coupon Management
 * - Offer Management
 * - Product Review Moderation
 * - Sales Reports & Analytics (JSON, CSV, PDF)
 * - Wallet Refunds History
 */

// ==========================================
// 1. ADMIN AUTHENTICATION
// ==========================================
export const adminLogin = async (credentials) => {
  const response = await axiosInstance.post("/api/admin/auth/login", credentials);
  return response.data;
};

export const checkAdminSession = async () => {
  const response = await axiosInstance.get("/api/admin/auth/session");
  return response.data;
};

export const adminLogout = async () => {
  const response = await axiosInstance.post("/api/admin/auth/logout");
  return response.data;
};

// ==========================================
// 2. ADMIN USER MANAGEMENT
// ==========================================
export const getAdminUsers = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/users", { params });
  return response.data;
};

export const createAdminUser = async (userData) => {
  const response = await axiosInstance.post("/api/admin/users", userData);
  return response.data;
};

export const updateAdminUser = async (userId, userData) => {
  const response = await axiosInstance.put(`/api/admin/users/${userId}`, userData);
  return response.data;
};

export const blockUser = async (userId) => {
  const response = await axiosInstance.patch(`/api/admin/users/${userId}/block`);
  return response.data;
};

export const unblockUser = async (userId) => {
  const response = await axiosInstance.patch(`/api/admin/users/${userId}/unblock`);
  return response.data;
};

export const deleteAdminUser = async (userId) => {
  const response = await axiosInstance.delete(`/api/admin/users/${userId}`);
  return response.data;
};

// ==========================================
// 3. ADMIN CATEGORIES
// ==========================================
export const getAdminCategories = async () => {
  const response = await axiosInstance.get("/api/admin/categories");
  return response.data;
};

export const getAdminCategoryBySlug = async (slug) => {
  const response = await axiosInstance.get(`/api/admin/categories/${slug}`);
  return response.data;
};

export const createAdminCategory = async (categoryData) => {
  const response = await axiosInstance.post("/api/admin/categories", categoryData);
  return response.data;
};

export const updateAdminCategory = async (id, categoryData) => {
  const response = await axiosInstance.put(`/api/admin/categories/${id}`, categoryData);
  return response.data;
};

export const deleteAdminCategory = async (id) => {
  const response = await axiosInstance.delete(`/api/admin/categories/${id}`);
  return response.data;
};

export const toggleCategoryStatus = async (id, statusData = {}) => {
  const response = await axiosInstance.patch(`/api/admin/categories/${id}/status`, statusData);
  return response.data;
};

export const toggleCategoryStatusBySlug = async (slug, statusData = {}) => {
  const response = await axiosInstance.patch(`/api/admin/categories/${slug}/status`, statusData);
  return response.data;
};

// ==========================================
// 4. ADMIN PRODUCTS
// ==========================================
export const getAdminProducts = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/products", { params });
  return response.data;
};

export const getAdminProductById = async (id) => {
  const response = await axiosInstance.get(`/api/admin/products/${id}`);
  return response.data;
};

export const createAdminProduct = async (productData) => {
  const response = await axiosInstance.post("/api/admin/products", productData);
  return response.data;
};

export const createCategoryProduct = async (categorySlug, productData) => {
  const response = await axiosInstance.post(
    `/api/admin/categories/${categorySlug}/products`,
    productData
  );
  return response.data;
};

export const updateAdminProduct = async (id, productData) => {
  const response = await axiosInstance.put(`/api/admin/products/${id}`, productData);
  return response.data;
};

export const deleteAdminProduct = async (id) => {
  const response = await axiosInstance.delete(`/api/admin/products/${id}`);
  return response.data;
};

export const toggleProductStatus = async (id) => {
  const response = await axiosInstance.patch(`/api/admin/products/${id}/status`);
  return response.data;
};

// ==========================================
// 5. ADMIN ORDERS
// ==========================================
export const getAdminOrders = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/orders", { params });
  return response.data;
};

export const getAdminOrderById = async (orderId) => {
  const response = await axiosInstance.get(`/api/admin/orders/${orderId}`);
  return response.data;
};

export const updateOrderStatus = async (orderId, statusData) => {
  const response = await axiosInstance.patch(`/api/admin/orders/${orderId}/status`, statusData);
  return response.data;
};

export const updateOrderTracking = async (orderId, trackingData) => {
  const response = await axiosInstance.patch(`/api/admin/orders/${orderId}/tracking`, trackingData);
  return response.data;
};

export const updateOrderPaymentStatus = async (orderId, paymentData) => {
  const response = await axiosInstance.patch(`/api/admin/orders/${orderId}/payment-status`, paymentData);
  return response.data;
};

export const approveItemReturn = async (orderId, itemId, payload = {}) => {
  const response = await axiosInstance.post(
    `/api/admin/orders/${orderId}/items/${itemId}/approve-return`,
    payload
  );
  return response.data;
};

export const rejectItemReturn = async (orderId, itemId, payload = {}) => {
  const response = await axiosInstance.post(
    `/api/admin/orders/${orderId}/items/${itemId}/reject-return`,
    payload
  );
  return response.data;
};

export const downloadAdminInvoice = async (orderId) => {
  const response = await axiosInstance.get(`/api/admin/orders/${orderId}/invoice`, {
    responseType: "blob",
  });
  return response.data;
};

// ==========================================
// 6. ADMIN RETURNS
// ==========================================
export const getAdminReturns = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/returns", { params });
  return response.data;
};

export const getAdminReturnById = async (id) => {
  const response = await axiosInstance.get(`/api/admin/returns/${id}`);
  return response.data;
};

export const approveAdminReturn = async (id, payload = {}) => {
  const response = await axiosInstance.post(`/api/admin/returns/${id}/approve`, payload);
  return response.data;
};

export const rejectAdminReturn = async (id, payload = {}) => {
  const response = await axiosInstance.post(`/api/admin/returns/${id}/reject`, payload);
  return response.data;
};

// ==========================================
// 7. ADMIN COUPONS
// ==========================================
export const getAdminCoupons = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/coupons", { params });
  return response.data;
};

export const getAdminCouponById = async (id) => {
  const response = await axiosInstance.get(`/api/admin/coupons/${id}`);
  return response.data;
};

export const createAdminCoupon = async (couponData) => {
  const response = await axiosInstance.post("/api/admin/coupons", couponData);
  return response.data;
};

export const updateAdminCoupon = async (id, couponData) => {
  const response = await axiosInstance.put(`/api/admin/coupons/${id}`, couponData);
  return response.data;
};

export const toggleCouponStatus = async (id) => {
  const response = await axiosInstance.patch(`/api/admin/coupons/${id}/status`);
  return response.data;
};

export const deleteAdminCoupon = async (id) => {
  const response = await axiosInstance.delete(`/api/admin/coupons/${id}`);
  return response.data;
};

// ==========================================
// 8. ADMIN OFFERS
// ==========================================
export const getAdminOffers = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/offers", { params });
  return response.data;
};

export const searchOfferProducts = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/offers/search-products", { params });
  return response.data;
};

export const getAdminOfferById = async (id) => {
  const response = await axiosInstance.get(`/api/admin/offers/${id}`);
  return response.data;
};

export const createAdminOffer = async (offerData) => {
  const response = await axiosInstance.post("/api/admin/offers", offerData);
  return response.data;
};

export const updateAdminOffer = async (id, offerData) => {
  const response = await axiosInstance.put(`/api/admin/offers/${id}`, offerData);
  return response.data;
};

export const toggleOfferStatus = async (id) => {
  const response = await axiosInstance.patch(`/api/admin/offers/${id}/status`);
  return response.data;
};

export const deleteAdminOffer = async (id) => {
  const response = await axiosInstance.delete(`/api/admin/offers/${id}`);
  return response.data;
};

// ==========================================
// 9. ADMIN REVIEWS
// ==========================================
export const getAdminReviews = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/reviews", { params });
  return response.data;
};

export const updateAdminReviewStatus = async (id, statusData) => {
  const response = await axiosInstance.patch(`/api/admin/reviews/${id}/status`, statusData);
  return response.data;
};

export const deleteAdminReview = async (id) => {
  const response = await axiosInstance.delete(`/api/admin/reviews/${id}`);
  return response.data;
};

// ==========================================
// 10. ADMIN SALES & ANALYTICS
// ==========================================
export const getDashboardRevenue = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/sales/dashboard-revenue", { params });
  return response.data;
};

export const getSalesOverview = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/sales/overview", { params });
  return response.data;
};

export const getSalesTrends = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/sales/trends", { params });
  return response.data;
};

export const getSalesCategories = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/sales/categories", { params });
  return response.data;
};

export const getSalesPayments = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/sales/payments", { params });
  return response.data;
};

export const getSalesCoupons = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/sales/coupons", { params });
  return response.data;
};

export const getProductPerformance = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/sales/products", { params });
  return response.data;
};

export const getSalesReport = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/sales/report", { params });
  return response.data;
};

export const exportSalesCSV = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/sales/export", {
    params,
    responseType: "blob",
  });
  return response.data;
};

export const exportSalesPDF = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/sales/export-pdf", {
    params,
    responseType: "blob",
  });
  return response.data;
};

export const getAdminSalesOrderDetails = async (orderId) => {
  const response = await axiosInstance.get(`/api/admin/sales/orders/${orderId}`);
  return response.data;
};

export const approveSalesItemReturn = async (orderId, itemId, payload = {}) => {
  const response = await axiosInstance.post(
    `/api/admin/sales/orders/${orderId}/items/${itemId}/approve-return`,
    payload
  );
  return response.data;
};

export const rejectSalesItemReturn = async (orderId, itemId, payload = {}) => {
  const response = await axiosInstance.post(
    `/api/admin/sales/orders/${orderId}/items/${itemId}/reject-return`,
    payload
  );
  return response.data;
};

// ==========================================
// 11. ADMIN WALLET REFUNDS
// ==========================================
export const getAdminWalletRefunds = async (params = {}) => {
  const response = await axiosInstance.get("/api/admin/wallet-refunds", { params });
  return response.data;
};

export const getAdminWalletRefundById = async (transactionId) => {
  const response = await axiosInstance.get(`/api/admin/wallet-refunds/${transactionId}`);
  return response.data;
};

export const adminService = {
  // Auth
  adminLogin,
  checkAdminSession,
  adminLogout,
  // Users
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  blockUser,
  unblockUser,
  deleteAdminUser,
  // Categories
  getAdminCategories,
  getAdminCategoryBySlug,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  toggleCategoryStatus,
  toggleCategoryStatusBySlug,
  // Products
  getAdminProducts,
  getAdminProductById,
  createAdminProduct,
  createCategoryProduct,
  updateAdminProduct,
  deleteAdminProduct,
  toggleProductStatus,
  // Orders
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  updateOrderTracking,
  updateOrderPaymentStatus,
  approveItemReturn,
  rejectItemReturn,
  downloadAdminInvoice,
  // Returns
  getAdminReturns,
  getAdminReturnById,
  approveAdminReturn,
  rejectAdminReturn,
  // Coupons
  getAdminCoupons,
  getAdminCouponById,
  createAdminCoupon,
  updateAdminCoupon,
  toggleCouponStatus,
  deleteAdminCoupon,
  // Offers
  getAdminOffers,
  searchOfferProducts,
  getAdminOfferById,
  createAdminOffer,
  updateAdminOffer,
  toggleOfferStatus,
  deleteAdminOffer,
  // Reviews
  getAdminReviews,
  updateAdminReviewStatus,
  deleteAdminReview,
  // Sales
  getDashboardRevenue,
  getSalesOverview,
  getSalesTrends,
  getSalesCategories,
  getSalesPayments,
  getSalesCoupons,
  getProductPerformance,
  getSalesReport,
  exportSalesCSV,
  exportSalesPDF,
  getAdminSalesOrderDetails,
  approveSalesItemReturn,
  rejectSalesItemReturn,
  // Wallet refunds
  getAdminWalletRefunds,
  getAdminWalletRefundById,
};

export default adminService;
