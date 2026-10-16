import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import "./WishlistDrawer.css";

function WishlistDrawer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    wishlist,
    wishlistCount,
    isWishlistOpen,
    closeWishlist,
    removeFromWishlist,
    moveItemToCart,
    actionLoading: wishlistActionLoading,
    loading: wishlistLoading,
    error: wishlistError,
  } = useWishlist();

  const { actionLoading: cartActionLoading } = useCart();

  // State for item to remove (confirmation modal)
  const [itemToRemove, setItemToRemove] = useState(null);

  // Local feedback message inside drawer (e.g. after adding to cart)
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: string }

  // Manage body scroll lock & Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (itemToRemove) {
          setItemToRemove(null);
        } else if (isWishlistOpen) {
          closeWishlist();
        }
      }
    };

    if (isWishlistOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isWishlistOpen, closeWishlist, itemToRemove]);

  // Clear feedback when drawer closes
  useEffect(() => {
    if (!isWishlistOpen) {
      setFeedback(null);
      setItemToRemove(null);
    }
  }, [isWishlistOpen]);

  if (!isWishlistOpen) return null;

  const formatPrice = (val) => {
    if (val === undefined || val === null) return "₹0";
    return `₹${Number(val).toLocaleString("en-IN")}`;
  };

  const getImageUrl = (imgPath) => {
    if (!imgPath) return null;
    if (imgPath.startsWith("http://") || imgPath.startsWith("https://")) {
      return imgPath;
    }
    return `http://localhost:5000${imgPath}`;
  };

  const handleExploreClick = () => {
    closeWishlist();
    navigate("/collections");
  };

  const handleViewFullWishlist = () => {
    closeWishlist();
    navigate("/wishlist");
  };

  // Add Wishlist product directly to Cart and automatically remove from Wishlist
  const handleAddToCart = async (item) => {
    if (!item) return;
    if (item.isInactive) {
      setFeedback({
        type: "error",
        text: "This fragrance is currently unavailable.",
      });
      return;
    }
    if (item.isOutOfStock || item.stock === 0) {
      setFeedback({
        type: "error",
        text: "This fragrance is currently out of stock.",
      });
      return;
    }

    const res = await moveItemToCart(item.productId || item._id, 1);

    if (res.requiresLogin) {
      setFeedback({
        type: "error",
        text: res.message,
      });
    } else if (res.success) {
      setFeedback({
        type: "success",
        text: `${item.name} added to your shopping bag and removed from wishlist.`,
      });
    } else {
      setFeedback({
        type: "error",
        text: res.message || "Maximum 5 items allowed per product.",
      });
    }
  };

  // Confirm removal of item
  const handleConfirmRemove = async () => {
    if (!itemToRemove) return;
    const prodId = itemToRemove.productId || itemToRemove._id;
    const res = await removeFromWishlist(prodId);
    if (res.success) {
      setFeedback({
        type: "success",
        text: `"${itemToRemove.name}" removed from your wishlist.`,
      });
    } else {
      setFeedback({
        type: "error",
        text: res.message || "Unable to remove item.",
      });
    }
    setItemToRemove(null);
  };

  return (
    <div
      className="wishlist-drawer-root"
      role="dialog"
      aria-modal="true"
      aria-label="Wishlist Drawer"
    >
      {/* 1. Backdrop */}
      <div
        className="wishlist-drawer-backdrop"
        onClick={closeWishlist}
        aria-hidden="true"
      />

      {/* 2. Slide-out Panel */}
      <aside className="wishlist-drawer-panel">
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-header-title">
            <span className="drawer-title-eyebrow">ATELIER ARCHIVE</span>
            <h2 className="drawer-title-main">
              WISHLIST <span className="drawer-item-count">({wishlistCount || 0})</span>
            </h2>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={closeWishlist}
            aria-label="Close wishlist"
          >
            ✕
          </button>
        </div>

        {/* Sub-header tagline */}
        <div className="wishlist-drawer-banner">
          <span className="wishlist-banner-text">
            Saved olfactory formulations reserved for your signature collection.
          </span>
        </div>

        {/* Feedback Alert if present */}
        {feedback && (
          <div className={`wishlist-drawer-alert ${feedback.type}`} role="status">
            <span className="drawer-alert-icon">
              {feedback.type === "success" ? "✓" : "ℹ️"}
            </span>
            <span className="drawer-alert-text">{feedback.text}</span>
            <button
              type="button"
              className="drawer-alert-close"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          </div>
        )}

        {wishlistError && (
          <div className="wishlist-drawer-alert error" role="alert">
            <span className="drawer-alert-icon">⚠️</span>
            <span className="drawer-alert-text">{wishlistError}</span>
          </div>
        )}

        {/* Scrollable Items Container */}
        <div className="wishlist-items-scroll">
          {/* User not logged in */}
          {!user ? (
            <div className="drawer-auth-prompt">
              <span className="auth-prompt-icon">♡</span>
              <h3>Sign in to access your wishlist</h3>
              <p>
                Save and curate your private fragrance archive across all your devices.
              </p>
              <button
                type="button"
                className="drawer-auth-btn"
                onClick={() => {
                  closeWishlist();
                  navigate("/login");
                }}
              >
                SIGN IN TO FEXA
              </button>
            </div>
          ) : wishlistLoading ? (
            /* Loading State */
            <div className="wishlist-loading-state">
              <div className="wishlist-spinner" />
              <p>Curating your personal archive...</p>
            </div>
          ) : wishlist.length === 0 ? (
            /* Empty State */
            <div className="wishlist-empty-state">
              <div className="empty-state-flacon">
                <span>♡</span>
              </div>
              <h3 className="empty-state-headline">Your wishlist is empty</h3>
              <p className="empty-state-subtext">
                Save your favorite products here and come back when you're ready.
              </p>
              <button
                type="button"
                className="empty-state-cta-btn"
                onClick={handleExploreClick}
              >
                EXPLORE COLLECTIONS →
              </button>
            </div>
          ) : (
            /* Wishlist Products List */
            <div className="wishlist-items-list">
              {wishlist.map((item) => {
                const imgSrc = getImageUrl(item.primaryImage);
                const hasDiscount =
                  item.compareAtPrice && item.compareAtPrice > item.price;
                const discountPct = hasDiscount
                  ? Math.round(
                      ((item.compareAtPrice - item.price) / item.compareAtPrice) * 100
                    )
                  : 0;

                return (
                  <div
                    key={item._id || item.productId}
                    className="wishlist-product-item"
                  >
                    {/* Thumbnail */}
                    <div
                      className="wishlist-item-media"
                      onClick={() => {
                        closeWishlist();
                        navigate(`/products/${item.productId || item._id}`);
                      }}
                      title="View product details"
                    >
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={item.name}
                          className="wishlist-item-img"
                        />
                      ) : (
                        <div className="wishlist-item-fallback">
                          <span>FEXA</span>
                          <small>⚗️</small>
                        </div>
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="wishlist-item-details">
                      <div className="wishlist-item-top-row">
                        <span className="wishlist-item-brand">
                          {item.brand || "FEXA"}
                        </span>
                        {/* Remove button */}
                        <button
                          type="button"
                          className="wishlist-item-remove-btn"
                          onClick={() => setItemToRemove(item)}
                          title="Remove from wishlist"
                          aria-label={`Remove ${item.name} from wishlist`}
                          disabled={wishlistActionLoading}
                        >
                          🗑
                        </button>
                      </div>

                      <h4
                        className="wishlist-item-name"
                        onClick={() => {
                          closeWishlist();
                          navigate(`/products/${item.productId || item._id}`);
                        }}
                        title={item.name}
                      >
                        {item.name}
                      </h4>

                      <div className="wishlist-item-specs">
                        <span className="wishlist-item-cat">{item.category}</span>
                        <span className="spec-dot">•</span>
                        <span>100ml Extrait</span>
                      </div>

                      {/* Status / Availability Badge */}
                      <div className="wishlist-status-row">
                        {item.isInactive ? (
                          <span className="wishlist-badge unavailable">
                            Currently Unavailable
                          </span>
                        ) : item.isOutOfStock ? (
                          <span className="wishlist-badge out">Out of Stock</span>
                        ) : item.stock <= 5 ? (
                          <span className="wishlist-badge low">
                            Only {item.stock} left in stock
                          </span>
                        ) : (
                          <span className="wishlist-badge in">In Stock</span>
                        )}
                      </div>

                      {/* Pricing Row */}
                      <div className="wishlist-pricing-row">
                        <span className="wishlist-price">
                          {formatPrice(item.price)}
                        </span>
                        {hasDiscount && (
                          <>
                            <span className="wishlist-compare-price">
                              {formatPrice(item.compareAtPrice)}
                            </span>
                            <span className="wishlist-discount-tag">
                              {discountPct}% OFF
                            </span>
                          </>
                        )}
                      </div>

                      {/* Add to Cart Action */}
                      <div className="wishlist-actions-row">
                        <button
                          type="button"
                          className="wishlist-add-cart-btn"
                          onClick={() => handleAddToCart(item)}
                          disabled={
                            item.isInactive ||
                            item.isOutOfStock ||
                            cartActionLoading
                          }
                          aria-label={`Add ${item.name} to shopping bag`}
                        >
                          {item.isInactive
                            ? "UNAVAILABLE"
                            : item.isOutOfStock
                            ? "OUT OF STOCK"
                            : "+ ADD TO BAG"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info banner & actions */}
        {user && wishlist.length > 0 && (
          <div className="wishlist-drawer-footer">
            <button
              type="button"
              className="wishlist-view-full-btn"
              onClick={handleViewFullWishlist}
            >
              VIEW FULL WISHLIST →
            </button>
            <button
              type="button"
              className="wishlist-footer-explore-btn"
              onClick={handleExploreClick}
            >
              EXPLORE COLLECTIONS
            </button>
          </div>
        )}

        {/* Remove Confirmation Popup Modal */}
        {itemToRemove && (
          <div
            className="wishlist-remove-modal-backdrop"
            onClick={() => setItemToRemove(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wishlist-remove-modal-title"
          >
            <div
              className="wishlist-remove-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="remove-modal-icon">♡</div>
              <h3
                id="wishlist-remove-modal-title"
                className="remove-modal-title"
              >
                Remove from Wishlist?
              </h3>
              <p className="remove-modal-desc">
                Are you sure you want to remove <strong>"{itemToRemove.name}"</strong> from your wishlist?
              </p>
              <div className="remove-modal-actions">
                <button
                  type="button"
                  className="remove-modal-cancel-btn"
                  onClick={() => setItemToRemove(null)}
                  disabled={wishlistActionLoading}
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  className="remove-modal-confirm-btn"
                  onClick={handleConfirmRemove}
                  disabled={wishlistActionLoading}
                >
                  {wishlistActionLoading ? "REMOVING..." : "REMOVE"}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default WishlistDrawer;
