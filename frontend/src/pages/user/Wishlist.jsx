import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/common/Navbar";
import "./Wishlist.css";

function Wishlist() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    wishlist,
    wishlistCount,
    removeFromWishlist,
    moveItemToCart,
    openWishlist,
    actionLoading,
    loading,
    error,
  } = useWishlist();

  const { cart, openCart, actionLoading: cartActionLoading } = useCart();

  // State for item to remove via confirmation modal
  const [itemToRemove, setItemToRemove] = useState(null);

  // Action toast / feedback message
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: string }

  // Auto-dismiss feedback after 4 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Handle Escape key to close confirmation modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && itemToRemove) {
        setItemToRemove(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [itemToRemove]);

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

  // Add to cart with automatic removal from Wishlist
  const handleAddToCart = async (product) => {
    if (!product) return;
    const prodId = product.productId || product._id;

    if (product.isInactive) {
      setFeedback({
        type: "error",
        text: "This fragrance is currently unavailable.",
      });
      return;
    }

    if (product.isOutOfStock || product.stock === 0) {
      setFeedback({
        type: "error",
        text: "This fragrance is currently out of stock.",
      });
      return;
    }

    const res = await moveItemToCart(prodId, 1);

    if (res.requiresLogin) {
      setFeedback({
        type: "error",
        text: res.message,
      });
    } else if (res.success) {
      setFeedback({
        type: "success",
        text: `${product.name} added to your shopping bag and removed from wishlist.`,
      });
    } else {
      setFeedback({
        type: "error",
        text: res.message || "Maximum 5 items allowed per product.",
      });
    }
  };

  // Confirm remove from Wishlist
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
    <div className="fexa-wishlist-page">
      {/* 1. Luxury Navbar */}
      <Navbar activePage="wishlist" />

      {/* 3. Breadcrumb */}
      <div className="wishlist-breadcrumb-bar">
        <div className="breadcrumb-inner">
          <div className="breadcrumb-path">
            <Link to="/home" className="crumb-link">
              HOME
            </Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">MY WISHLIST</span>
          </div>
          <div className="breadcrumb-count-indicator">
            <span>{wishlistCount} {wishlistCount === 1 ? "FLACON SAVED" : "FLACONS SAVED"}</span>
          </div>
        </div>
      </div>

      {/* 4. Feedback Banner / Toast */}
      {feedback && (
        <div className={`wishlist-feedback-banner ${feedback.type}`} role="status">
          <span className="feedback-icon">{feedback.type === "success" ? "✓" : "ℹ️"}</span>
          <span className="feedback-text">{feedback.text}</span>
          <button
            type="button"
            className="feedback-close-btn"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="wishlist-feedback-banner error" role="alert">
          <span className="feedback-icon">⚠️</span>
          <span className="feedback-text">{error}</span>
        </div>
      )}

      {/* 5. Main Content Area */}
      <main className="wishlist-main-content">
        {/* Editorial Section Header */}
        <section className="wishlist-header-section">
          <div className="header-eyebrow">ATELIER CURATION • PRIVATE ARCHIVE</div>
          <h2 className="wishlist-main-title">
            My Wishlist <span className="title-count-pill">({wishlistCount})</span>
          </h2>
          <p className="wishlist-lead-description">
            Your personal treasury of haute parfumerie formulations. Saved extraits and rare botanical macerations reserved for your signature fragrance journey.
          </p>
        </section>

        {/* Loading State */}
        {loading ? (
          <div className="wishlist-loading-container">
            <div className="wishlist-spinner-ring" />
            <p>Retrieving your private flacon archive...</p>
          </div>
        ) : wishlist.length === 0 ? (
          /* Empty Wishlist State */
          <div className="wishlist-empty-container">
            <div className="empty-flacon-monogram">
              <span>♡</span>
            </div>
            <h3 className="empty-title">My Wishlist is Empty</h3>
            <p className="empty-description">
              Save your favorite products here and come back when you're ready.
            </p>
            <button
              type="button"
              className="empty-explore-btn"
              onClick={() => navigate("/collections")}
            >
              Explore Collections →
            </button>
          </div>
        ) : (
          /* Products Grid */
          <div className="wishlist-grid">
            {wishlist.map((item) => {
              const prodId = item.productId || item._id;
              const imgSrc = getImageUrl(item.primaryImage);
              const hasDiscount =
                item.compareAtPrice && item.compareAtPrice > item.price;
              const discountPct = hasDiscount
                ? Math.round(
                    ((item.compareAtPrice - item.price) / item.compareAtPrice) * 100
                  )
                : 0;

              return (
                <div key={prodId} className="wishlist-card">
                  {/* Card Media Wrapper */}
                  <div
                    className="wishlist-card-media"
                    onClick={() => navigate(`/products/${prodId}`)}
                  >
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={item.name}
                        className="wishlist-card-img"
                      />
                    ) : (
                      <div className="wishlist-card-fallback">
                        <span className="fallback-brand">FEXA</span>
                        <span className="fallback-icon">⚗️</span>
                      </div>
                    )}

                    {/* Top Badges */}
                    <div className="card-top-badges">
                      <span className={`category-tag ${item.category?.toLowerCase()}`}>
                        {item.category?.toUpperCase()}
                      </span>
                      {item.isOutOfStock && (
                        <span className="stock-tag out">OUT OF STOCK</span>
                      )}
                    </div>

                    {/* Wishlist Remove / Heart Action Button */}
                    <button
                      type="button"
                      className="card-remove-heart-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToRemove(item);
                      }}
                      title="Remove from wishlist"
                      aria-label={`Remove ${item.name} from wishlist`}
                      disabled={actionLoading}
                    >
                      ♥
                    </button>
                  </div>

                  {/* Card Body Details */}
                  <div className="wishlist-card-body">
                    <div className="card-brand-label">{item.brand || "FEXA"}</div>

                    <h3
                      className="card-product-name"
                      onClick={() => navigate(`/products/${prodId}`)}
                      title={item.name}
                    >
                      {item.name}
                    </h3>

                    <div className="card-specs-row">
                      <span>{item.category}</span>
                      <span className="spec-dot">•</span>
                      <span>100ml Extrait</span>
                    </div>

                    {/* Availability Status Badge */}
                    <div className="card-status-badge-row">
                      {item.isInactive ? (
                        <span className="status-badge unavailable">
                          Currently Unavailable
                        </span>
                      ) : item.isOutOfStock ? (
                        <span className="status-badge out">Out of Stock</span>
                      ) : item.stock <= 5 ? (
                        <span className="status-badge low">
                          Only {item.stock} left in stock
                        </span>
                      ) : (
                        <span className="status-badge in">In Stock</span>
                      )}
                    </div>

                    {/* Pricing */}
                    <div className="card-pricing-row">
                      <span className="current-price">
                        {formatPrice(item.price)}
                      </span>
                      {hasDiscount && (
                        <>
                          <span className="original-price">
                            {formatPrice(item.compareAtPrice)}
                          </span>
                          <span className="discount-tag">
                            {discountPct}% OFF
                          </span>
                        </>
                      )}
                    </div>

                    {/* Action Buttons Row */}
                    <div className="card-action-row">
                      <button
                        type="button"
                        className="btn-add-to-cart-from-wishlist"
                        onClick={() => handleAddToCart(item)}
                        disabled={
                          item.isInactive ||
                          item.isOutOfStock ||
                          actionLoading ||
                          cartActionLoading
                        }
                        aria-label={`Add ${item.name} to shopping bag`}
                      >
                        {item.isInactive
                          ? "CURRENTLY UNAVAILABLE"
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
      </main>

      {/* 6. Remove Confirmation Popup Modal */}
      {itemToRemove && (
        <div
          className="wishlist-modal-backdrop"
          onClick={() => setItemToRemove(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-modal-heading"
        >
          <div
            className="wishlist-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-icon-badge">♡</div>
            <h3 id="remove-modal-heading" className="modal-heading">
              Remove from Wishlist?
            </h3>
            <p className="modal-description">
              Are you sure you want to remove <strong>"{itemToRemove.name}"</strong> from your wishlist?
            </p>
            <div className="modal-button-actions">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setItemToRemove(null)}
                disabled={actionLoading}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="modal-confirm-btn"
                onClick={handleConfirmRemove}
                disabled={actionLoading}
              >
                {actionLoading ? "REMOVING..." : "REMOVE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Luxury Footer */}
      <footer className="wishlist-footer">
        <div className="footer-inner">
          <div className="footer-copy">
            © {new Date().getFullYear()} FEXA HAUTE PARFUMERIE • GRASSE, FRANCE. ALL RIGHTS RESERVED.
          </div>
          <div className="footer-links">
            <span onClick={() => navigate("/collections")}>COLLECTIONS</span>
            <span>•</span>
            <span onClick={() => navigate("/about")}>ABOUT FEXA</span>
            <span>•</span>
            <span onClick={() => navigate("/profile")}>ATELIER ACCOUNT</span>
            <span>•</span>
            <span onClick={() => navigate("/cart")}>SHOPPING BAG</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Wishlist;
