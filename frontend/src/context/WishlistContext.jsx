import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import {
  getWishlist,
  addToWishlist as addToWishlistService,
  removeFromWishlist as removeFromWishlistService,
  moveToCart as moveToCartService,
} from "../services/wishlist.service.js";

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

      const data = await getWishlist();

      if (data && data.success && Array.isArray(data.wishlist)) {
        setWishlist(data.wishlist);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setWishlist([]);
      } else {
        console.error("Wishlist fetch error:", err);
        setError(err.response?.data?.message || "Unable to connect to the atelier service.");
      }
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

      const data = await addToWishlistService(productId);

      if (data && data.success) {
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
        const msg = data?.message || "Unable to add fragrance to wishlist.";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Add to wishlist error:", err);
      const msg = err.response?.data?.message || "Unable to connect to the atelier service. Please try again.";
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

      const data = await removeFromWishlistService(productId);

      if (data && data.success) {
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
        const msg = data?.message || "Unable to remove item from wishlist.";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Remove from wishlist error:", err);
      const msg = err.response?.data?.message || "Unable to connect to the atelier service. Please try again.";
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

      const data = await moveToCartService({ productId, variantId, quantity });

      if (data && data.success) {
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
        const msg = data?.message || "Unable to add product to your bag.";
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err) {
      console.error("Move item to cart error:", err);
      const msg = err.response?.data?.message || "Unable to connect to the atelier service. Please try again.";
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
