import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";

const WishlistContext = createContext();

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};

export const WishlistProvider = ({ children }) => {
  const { user } = useAuth();
  const { setCart } = useCart();

  const [wishlist, setWishlist] = useState([]);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch wishlist from MongoDB for the authenticated user
  const fetchWishlist = useCallback(async () => {
    if (!user) {
      setWishlist([]);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch("http://localhost:5000/api/wishlist", {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.wishlist)) {
          setWishlist(data.wishlist);
        }
      } else if (res.status === 401) {
        setWishlist([]);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Unable to load your wishlist.");
      }
    } catch (err) {
      console.error("Wishlist fetch error:", err);
      setError("Unable to connect to the atelier service.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load wishlist when user authentication state changes
  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  // Drawer visibility controls
  const openWishlist = () => setIsWishlistOpen(true);
  const closeWishlist = () => setIsWishlistOpen(false);
  const toggleWishlistDrawer = () => setIsWishlistOpen((prev) => !prev);

  // Check if a product is in the user's wishlist
  const isWishlisted = useCallback(
    (productOrId) => {
      if (!productOrId || !wishlist || wishlist.length === 0) return false;
      const targetId = typeof productOrId === "object" ? (productOrId.productId || productOrId._id) : productOrId;
      if (!targetId) return false;
      return wishlist.some(
        (item) => (item.productId || item._id || "").toString() === targetId.toString()
      );
    },
    [wishlist]
  );

  // Add product to wishlist
  const addToWishlist = async (productOrId) => {
    if (!user) {
      return {
        success: false,
        requiresLogin: true,
        message: "Please sign in to save fragrances to your wishlist.",
      };
    }

    const productId = typeof productOrId === "object" ? (productOrId.productId || productOrId._id) : productOrId;
    if (!productId) {
      return { success: false, message: "Invalid product identifier." };
    }

    try {
      setActionLoading(true);
      setError(null);

      const headers = { "Content-Type": "application/json" };
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        headers["Authorization"] = `Bearer ${storedToken}`;
      }

      const res = await fetch("http://localhost:5000/api/wishlist/items", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ productId }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (Array.isArray(data.wishlist)) {
          setWishlist(data.wishlist);
        } else {
          // Fallback refetch
          await fetchWishlist();
        }
        return {
          success: true,
          alreadyExists: Boolean(data.alreadyExists),
          message: data.message || "Added to your wishlist.",
        };
      } else {
        const msg = data.message || "Unable to add fragrance to wishlist.";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Add to wishlist error:", err);
      const msg = "Unable to connect to the atelier service. Please try again.";
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setActionLoading(false);
    }
  };

  // Remove product from wishlist
  const removeFromWishlist = async (productOrId) => {
    if (!user) {
      return {
        success: false,
        requiresLogin: true,
        message: "Please sign in to manage your wishlist.",
      };
    }

    const productId = typeof productOrId === "object" ? (productOrId.productId || productOrId._id) : productOrId;
    if (!productId) {
      return { success: false, message: "Invalid product identifier." };
    }

    try {
      setActionLoading(true);
      setError(null);

      const headers = {};
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        headers["Authorization"] = `Bearer ${storedToken}`;
      }

      const res = await fetch(`http://localhost:5000/api/wishlist/items/${productId}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (Array.isArray(data.wishlist)) {
          setWishlist(data.wishlist);
        } else {
          setWishlist((prev) =>
            prev.filter(
              (item) => (item.productId || item._id).toString() !== productId.toString()
            )
          );
        }
        return { success: true, message: data.message || "Removed from wishlist." };
      } else {
        const msg = data.message || "Unable to remove item from wishlist.";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Remove from wishlist error:", err);
      const msg = "Unable to connect to the atelier service. Please try again.";
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setActionLoading(false);
    }
  };

  // Convenience toggle method
  const toggleWishlist = async (productId) => {
    if (isWishlisted(productId)) {
      return await removeFromWishlist(productId);
    } else {
      return await addToWishlist(productId);
    }
  };

  // Move product from Wishlist to Cart (atomic add to cart + remove from wishlist)
  const moveItemToCart = async (productOrId, quantity = 1, options = {}) => {
    if (!user) {
      return {
        success: false,
        requiresLogin: true,
        message: "Please sign in to add items to your shopping bag.",
      };
    }

    const productId = typeof productOrId === "object" ? (productOrId.productId || productOrId._id) : productOrId;
    const { variantId = null } = options;

    try {
      setActionLoading(true);
      setError(null);

      const headers = { "Content-Type": "application/json" };
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        headers["Authorization"] = `Bearer ${storedToken}`;
      }

      const res = await fetch("http://localhost:5000/api/wishlist/move-to-cart", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ productId, variantId, quantity }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // 1. Update Cart state
        if (data.cart && setCart) {
          setCart(data.cart);
        }
        // 2. Update Wishlist state
        if (Array.isArray(data.wishlist)) {
          setWishlist(data.wishlist);
        } else {
          setWishlist((prev) =>
            prev.filter(
              (item) => (item.productId || item._id).toString() !== productId.toString()
            )
          );
        }
        return {
          success: true,
          message: data.message || "Added to your shopping bag and removed from wishlist.",
        };
      } else {
        const msg = data.message || "Unable to add product to your bag.";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Move item to cart error:", err);
      const msg = "Unable to connect to the atelier service. Please try again.";
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        wishlistCount: wishlist.length,
        isWishlistOpen,
        openWishlist,
        closeWishlist,
        toggleWishlistDrawer,
        isWishlisted,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        moveItemToCart,
        fetchWishlist,
        loading,
        actionLoading,
        error,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};
