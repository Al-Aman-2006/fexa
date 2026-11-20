import axiosInstance from "../api/axiosInstance.js";

/**
 * Wishlist Service
 * Handles customer wishlist operations: fetching wishlist, adding items, removing items, and moving items to cart.
 */

export const getWishlist = async () => {
  const response = await axiosInstance.get("/api/wishlist");
  return response.data;
};

export const addToWishlist = async (productId, variant = null) => {
  const payload = typeof productId === "object" ? productId : { productId, variant };
  const response = await axiosInstance.post("/api/wishlist/items", payload);
  return response.data;
};

export const removeFromWishlist = async (productId) => {
  const response = await axiosInstance.delete(`/api/wishlist/items/${productId}`);
  return response.data;
};

export const moveToCart = async (productId, variant = null, quantity = 1) => {
  let payload;
  if (typeof productId === "object" && productId !== null) {
    payload = productId;
  } else if (typeof variant === "object" && variant !== null) {
    payload = { productId, ...variant };
  } else {
    payload = { productId, variantId: variant, quantity };
  }
  const response = await axiosInstance.post("/api/wishlist/move-to-cart", payload);
  return response.data;
};

export const wishlistService = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
};

export default wishlistService;
