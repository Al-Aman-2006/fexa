import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

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
      const headers = {};
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        headers["Authorization"] = `Bearer ${storedToken}`;
      }

      const res = await fetch("http://localhost:5000/api/cart", {
        headers,
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.cart) {
          setCart(data.cart);
        }
      } else if (res.status === 401) {
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
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Unable to load your shopping bag.");
      }
    } catch (err) {
      console.error("Cart fetch error:", err);
      setError("Unable to connect to your shopping bag.");
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

      const headers = { "Content-Type": "application/json" };
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        headers["Authorization"] = `Bearer ${storedToken}`;
      }

      const res = await fetch("http://localhost:5000/api/cart/items", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ productId, variantId, volumeMl, quantity }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setCart(data.cart);
        // Automatically open the Cart Drawer on successful addition if openDrawer is true
        if (openDrawer) {
          setIsCartOpen(true);
        }
        return { success: true, message: data.message };
      } else {
        const msg = data.message || "Unable to add product to your bag.";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Add to cart error:", err);
      const msg = "Unable to connect to the server. Please try again.";
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
      const res = await fetch(`http://localhost:5000/api/cart/items/${identifier}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ quantity, variantId }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setCart(data.cart);
        return { success: true };
      } else {
        const msg = data.message || "Unable to update quantity.";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Update quantity error:", err);
      const msg = "Unable to connect to server.";
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
      const url = variantId
        ? `http://localhost:5000/api/cart/items/${identifier}?variantId=${encodeURIComponent(variantId)}`
        : `http://localhost:5000/api/cart/items/${identifier}`;

      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setCart(data.cart);
        return { success: true, message: data.message };
      } else {
        const msg = data.message || "Unable to remove item.";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Remove from cart error:", err);
      const msg = "Unable to connect to server.";
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
      const res = await fetch("http://localhost:5000/api/cart", {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setCart(data.cart);
        return { success: true };
      } else {
        const msg = data.message || "Unable to clear bag.";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Clear cart error:", err);
      return { success: false, message: "Unable to connect to server." };
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
