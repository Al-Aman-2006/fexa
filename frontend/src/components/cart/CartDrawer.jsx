import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import "./CartDrawer.css";

function CartDrawer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    cart,
    isCartOpen,
    closeCart,
    updateQuantity,
    removeFromCart,
    actionLoading,
    error,
  } = useCart();

  // State for remove product confirmation popup
  const [itemToRemove, setItemToRemove] = useState(null);

  // Close on Escape key & manage body scroll lock
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (itemToRemove) {
          setItemToRemove(null);
        } else if (isCartOpen) {
          closeCart();
        }
      }
    };

    if (isCartOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCartOpen, closeCart, itemToRemove]);

  if (!isCartOpen) return null;

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

  const handleCheckoutClick = () => {
    closeCart();
    navigate("/checkout");
  };

  const handleViewCartClick = () => {
    closeCart();
    navigate("/cart");
  };

  const handleExploreClick = () => {
    closeCart();
    navigate("/collections");
  };

  const freeShippingProgress = Math.min(
    100,
    Math.round(((cart.subtotal || 0) / (cart.freeShippingThreshold || 5000)) * 100)
  );

  return (
    <div className="cart-drawer-root" role="dialog" aria-modal="true" aria-label="Shopping Bag">
      {/* 1. Backdrop */}
      <div
        className="cart-drawer-backdrop"
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* 2. Slide-out Drawer Panel */}
      <aside className="cart-drawer-panel">
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-header-title">
            <span className="drawer-title-eyebrow">ATELIER ARCHIVE</span>
            <h2 className="drawer-title-main">
              YOUR BAG <span className="drawer-item-count">({cart.totalItems || 0})</span>
            </h2>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={closeCart}
            aria-label="Close shopping bag"
          >
            ✕
          </button>
        </div>

        {/* Complimentary Shipping Progress Banner */}
        <div className="drawer-shipping-banner">
          <div className="shipping-banner-text">
            {cart.qualifiesForFreeShipping ? (
              <span className="shipping-qualified">
                ✓ You qualify for complimentary elevated shipping.
              </span>
            ) : (
              <span>
                Add <strong>{formatPrice(cart.amountForFreeShipping)}</strong> for complimentary atelier shipping.
              </span>
            )}
          </div>
          <div className="shipping-progress-track">
            <div
              className={`shipping-progress-fill ${cart.qualifiesForFreeShipping ? "complete" : ""}`}
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>

        {/* Scrollable Items Container */}
        <div className="drawer-items-scroll">
          {/* If user is not logged in */}
          {!user ? (
            <div className="drawer-auth-prompt">
              <span className="auth-prompt-icon">♙</span>
              <h3>Sign in to access your bag</h3>
              <p>Save and review your selected haute parfumerie formulations across all devices.</p>
              <button
                type="button"
                className="drawer-auth-btn"
                onClick={() => {
                  closeCart();
                  navigate("/login");
                }}
              >
                SIGN IN TO FEXA
              </button>
            </div>
          ) : !cart.items || cart.items.length === 0 ? (
            /* Empty State */
            <div className="drawer-empty-state">
              <div className="empty-state-flacon">
                <span>⚗️</span>
              </div>
              <h3 className="empty-state-headline">Your bag is currently empty.</h3>
              <p className="empty-state-subtext">
                Discover a fragrance created for your signature. Hand-compounded extraits and rare botanical resins await.
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
            <>
              {error && (
                <div className="drawer-error-alert" role="alert">
                  <span className="drawer-error-icon">ℹ️</span>
                  <span className="drawer-error-text">{error}</span>
                </div>
              )}
              {/* Items List */}
              <div className="drawer-items-list">
              {cart.items.map((item) => {
                const imgSrc = getImageUrl(item.primaryImage);
                const maxAllowed = Math.min(item.stock, 5);
                const isMaxLimit = item.quantity >= maxAllowed;
                const itemKey = item._id || `${item.productId}-${item.variantId || "default"}`;
                const itemIdentifier = item._id || item.productId;

                return (
                  <div key={itemKey} className="drawer-cart-item">
                    {/* Item Media Thumbnail */}
                    <div
                      className="cart-item-media"
                      onClick={() => {
                        closeCart();
                        navigate(`/products/${item.productId}`);
                      }}
                    >
                      {imgSrc ? (
                        <img src={imgSrc} alt={item.name} className="cart-item-img" />
                      ) : (
                        <div className="cart-item-fallback">
                          <span>FEXA</span>
                          <small>⚗️</small>
                        </div>
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="cart-item-details">
                      <div className="cart-item-top-row">
                        <span className="cart-item-brand">{item.brand || "FEXA"}</span>
                        <button
                          type="button"
                          className="cart-item-remove-btn"
                          onClick={() => setItemToRemove(item)}
                          title="Remove item"
                          aria-label={`Remove ${item.name} from bag`}
                          disabled={actionLoading}
                        >
                          🗑
                        </button>
                      </div>

                      <h4
                        className="cart-item-name"
                        onClick={() => {
                          closeCart();
                          navigate(`/products/${item.productId}`);
                        }}
                        title={item.name}
                      >
                        {item.name}
                      </h4>

                      <div className="cart-item-specs">
                        <span className="cart-item-cat">{item.category}</span>
                        <span className="spec-dot">•</span>
                        <span className="cart-item-size-badge">Size: {item.volumeMl ? `${item.volumeMl} ml` : "100 ml"}</span>
                      </div>

                      {/* Stock / Status warning */}
                      {item.isInactive ? (
                        <span className="cart-item-alert unavailable">Currently unavailable</span>
                      ) : item.isOutOfStock ? (
                        <span className="cart-item-alert out">Out of stock</span>
                      ) : item.quantity >= 5 ? (
                        <span className="cart-item-alert limit">Max 5 allowed per size</span>
                      ) : item.quantity >= item.stock ? (
                        <span className="cart-item-alert limit">Max available stock ({item.stock})</span>
                      ) : null}

                      {/* Controls and Price row */}
                      <div className="cart-item-controls-row">
                        <div className="cart-item-qty-widget">
                          <button
                            type="button"
                            className="qty-widget-btn"
                            onClick={() => updateQuantity(itemIdentifier, item.quantity - 1, item.variantId)}
                            disabled={item.quantity <= 1 || actionLoading}
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="qty-widget-val">{item.quantity}</span>
                          <button
                            type="button"
                            className="qty-widget-btn"
                            onClick={() => {
                              if (item.quantity < maxAllowed) {
                                updateQuantity(itemIdentifier, item.quantity + 1, item.variantId);
                              }
                            }}
                            disabled={isMaxLimit || item.isOutOfStock || actionLoading}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        <div className="cart-item-pricing">
                          <span className="item-unit-price">{formatPrice(item.price)}</span>
                          {item.quantity > 1 && (
                            <span className="item-total-price">
                              Total: {formatPrice(item.itemTotal)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        </div>

        {/* Sticky Summary & Action Footer */}
        {user && cart.items && cart.items.length > 0 && (
          <div className="drawer-footer-summary">
            <div className="summary-subtotal-row">
              <span className="subtotal-label">SUBTOTAL</span>
              <span className="subtotal-amount">{formatPrice(cart.subtotal)}</span>
            </div>

            <div className="summary-notice-text">
              Inclusive of all taxes. Climate-controlled shipping calculated at checkout.
            </div>

            <div className="drawer-action-buttons">
              <button
                type="button"
                className="drawer-checkout-btn"
                onClick={handleCheckoutClick}
              >
                PROCEED TO CHECKOUT →
              </button>

              <button
                type="button"
                className="drawer-view-bag-btn"
                onClick={handleViewCartClick}
              >
                VIEW FULL BAG
              </button>
            </div>
          </div>
        )}

        {/* Remove Confirmation Popup Modal */}
        {itemToRemove && (
          <div
            className="cart-remove-modal-backdrop"
            onClick={() => setItemToRemove(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-modal-title"
          >
            <div
              className="cart-remove-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="remove-modal-icon">🗑</div>
              <h3 id="remove-modal-title" className="remove-modal-title">
                Remove from your bag?
              </h3>
              <p className="remove-modal-desc">
                Are you sure you want to remove <strong>"{itemToRemove.name} ({itemToRemove.volumeMl || 100} ml)"</strong> from your bag?
              </p>
              <div className="remove-modal-actions">
                <button
                  type="button"
                  className="remove-modal-cancel-btn"
                  onClick={() => setItemToRemove(null)}
                  disabled={actionLoading}
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  className="remove-modal-confirm-btn"
                  onClick={async () => {
                    const identifier = itemToRemove._id || itemToRemove.productId;
                    await removeFromCart(identifier, itemToRemove.variantId);
                    setItemToRemove(null);
                  }}
                  disabled={actionLoading}
                >
                  {actionLoading ? "REMOVING..." : "REMOVE"}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default CartDrawer;
