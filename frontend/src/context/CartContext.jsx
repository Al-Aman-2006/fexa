import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  getCart,
  addToCart as addToCartService,
  updateCartItemQuantity,
  removeCartItem,
  clearCart as clearCartService,
} from "../services/cart.service.js";

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const { user } = useAuth();

  const [cart, setCart] = useState({
    items: [],
    subtotal: 0,
    totalItems: 0,
    freeShippingThreshold: 5000,
    qualifiesForFreeShipping: false,
    amountForFreeShipping: 5000,
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch cart for authenticated user
  const fetchCart = useCallback(async () => {
    if (!user) {
      // If user logged out or unauthenticated, clear cart
      setCart({
        items: [],
        subtotal: 0,
        totalItems: 0,
        freeShippingThreshold: 5000,
        qualifiesForFreeShipping: false,
        amountForFreeShipping: 5000,
      });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await getCart();

      if (data && data.success && data.cart) {
        setCart(data.cart);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        // Unauthenticated session
        setCart({
          items: [],
          subtotal: 0,
          totalItems: 0,
          freeShippingThreshold: 5000,
          qualifiesForFreeShipping: false,
          amountForFreeShipping: 5000,
        });
      } else {
        console.error("Cart fetch error:", err);
        setError(err.response?.data?.message || "Unable to load your shopping bag.");
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load cart when user session changes
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Open / Close controls
  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  const toggleCart = () => setIsCartOpen((prev) => !prev);

  // Add to cart with variant support
  const addToCart = async (productId, quantity = 1, options = {}) => {
    const { variantId = null, volumeMl = null, openDrawer = true } = options;

    if (!user) {
      return {
        success: false,
        requiresLogin: true,
        message: "Please sign in to add items to your shopping bag.",
      };
    }

    try {
      setActionLoading(true);
      setError(null);

      const data = await addToCartService({ productId, variantId, volumeMl, quantity });

      if (data && data.success) {
        setCart(data.cart);
        // Automatically open the Cart Drawer on successful addition if openDrawer is true
        if (openDrawer) {
          setIsCartOpen(true);
        }
        return { success: true, message: data.message };
      } else {
        const msg = data?.message || "Unable to add product to your bag.";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Add to cart error:", err);
      const msg = err.response?.data?.message || "Unable to connect to the server. Please try again.";
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setActionLoading(false);
    }
  };

  // Update item quantity (identifier can be item._id or productId)
  const updateQuantity = async (identifier, quantity, variantId = null) => {
    if (!user) return { success: false, message: "Please sign in." };

    try {
      setActionLoading(true);
      setError(null);

      const data = await updateCartItemQuantity(identifier, quantity, variantId);

      if (data && data.success) {
        setCart(data.cart);
        return { success: true };
      } else {
        const msg = data?.message || "Unable to update quantity.";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Update quantity error:", err);
      const msg = err.response?.data?.message || "Unable to connect to server.";
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setActionLoading(false);
    }
  };

  // Remove item from cart (identifier can be item._id or productId)
  const removeFromCart = async (identifier, variantId = null) => {
    if (!user) return { success: false, message: "Please sign in." };

    try {
      setActionLoading(true);
      setError(null);

      const data = await removeCartItem(identifier, variantId);

      if (data && data.success) {
        setCart(data.cart);
        return { success: true, message: data.message };
      } else {
        const msg = data?.message || "Unable to remove item.";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Remove from cart error:", err);
      const msg = err.response?.data?.message || "Unable to connect to server.";
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setActionLoading(false);
    }
  };

  // Clear entire cart
  const clearCart = async () => {
    if (!user) return { success: false, message: "Please sign in." };

    try {
      setActionLoading(true);
      setError(null);

      const data = await clearCartService();

      if (data && data.success) {
        setCart(data.cart);
        return { success: true };
      } else {
        const msg = data?.message || "Unable to clear bag.";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Clear cart error:", err);
      const msg = err.response?.data?.message || "Unable to connect to server.";
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        setCart,
        isCartOpen,
        openCart,
        closeCart,
        toggleCart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        fetchCart,
        loading,
        actionLoading,
        error,
        cartCount: cart.totalItems || 0,
        subtotal: cart.subtotal || 0,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
