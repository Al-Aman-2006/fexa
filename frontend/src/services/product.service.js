import axiosInstance from "../api/axiosInstance.js";

/**
 * Product Service
 * Handles public product catalogue, categories, collections, and customer product reviews.
 */

export const getProducts = async (params = {}) => {
  const response = await axiosInstance.get("/api/products", { params });
  return response.data;
};

export const getProductById = async (id) => {
  const response = await axiosInstance.get(`/api/products/${id}`);
  return response.data;
};

export const getCategories = async () => {
  const response = await axiosInstance.get("/api/products/categories");
  return response.data;
};

export const getProductCollections = async () => {
  const response = await axiosInstance.get("/api/products/collections");
  return response.data;
};

// Review Endpoints
export const getProductReviews = async (productId, params = {}) => {
  const response = await axiosInstance.get(`/api/reviews/product/${productId}`, { params });
  return response.data;
};

export const submitProductReview = async (reviewData, productId = null) => {
  const url = productId ? `/api/reviews/product/${productId}` : "/api/reviews";
  const response = await axiosInstance.post(url, reviewData);
  return response.data;
};

export const updateProductReview = async (reviewId, reviewData) => {
  const response = await axiosInstance.put(`/api/reviews/${reviewId}`, reviewData);
  return response.data;
};

export const deleteProductReview = async (reviewId) => {
  const response = await axiosInstance.delete(`/api/reviews/${reviewId}`);
  return response.data;
};

export const productService = {
  getProducts,
  getProductById,
  getCategories,
  getProductCollections,
  getProductReviews,
  submitProductReview,
  updateProductReview,
  deleteProductReview,
};

export default productService;
