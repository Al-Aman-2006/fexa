import axiosInstance from "../api/axiosInstance.js";

/**
 * Cart Service
 * Handles customer shopping cart operations: retrieving cart, adding items, updating quantities, removing items, and clearing the cart.
 */

export const getCart = async () => {
  const response = await axiosInstance.get("/api/cart");
  return response.data;
};

export const addToCart = async (productId, quantity = 1, options = {}) => {
  let payload;
  if (typeof productId === "object" && productId !== null) {
    payload = productId;
  } else if (typeof options === "object" && options !== null) {
    payload = { productId, quantity, ...options };
  } else {
    payload = { productId, quantity, variant: options };
  }
  const response = await axiosInstance.post("/api/cart/items", payload);
  return response.data;
};

export const updateCartItemQuantity = async (productId, quantity, variantId = null) => {
  const payload = typeof quantity === "object" ? quantity : { quantity, variantId };
  const response = await axiosInstance.patch(`/api/cart/items/${productId}`, payload);
  return response.data;
};

export const removeCartItem = async (productId, variantId = null) => {
  const params = variantId ? { variantId } : {};
  const response = await axiosInstance.delete(`/api/cart/items/${productId}`, { params });
  return response.data;
};

export const clearCart = async () => {
  const response = await axiosInstance.delete("/api/cart");
  return response.data;
};

export const cartService = {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
};

export default cartService;
