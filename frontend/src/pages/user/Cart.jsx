import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/common/Navbar";
import "./Cart.css";

function Cart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    openCart,
    actionLoading,
  } = useCart();

  const [itemToRemove, setItemToRemove] = useState(null);

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

  const handleClearBag = () => {
    if (window.confirm("Are you sure you wish to clear all fragrances from your shopping bag?")) {
      clearCart();
    }
  };

  const freeShippingProgress = Math.min(
    100,
    Math.round(((cart.subtotal || 0) / (cart.freeShippingThreshold || 5000)) * 100)
  );

  return (
    <div className="fexa-full-cart-page">
      {/* 1. Luxury Navbar */}
      <Navbar activePage="cart" />

      {/* 3. Breadcrumb */}
      <div className="cart-breadcrumb-bar">
        <div className="breadcrumb-inner">
          <div className="breadcrumb-path">
            <Link to="/home" className="crumb-link">HOME</Link>
            <span className="crumb-sep">/</span>
            <Link to="/collections" className="crumb-link">COLLECTIONS</Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">SHOPPING BAG</span>
          </div>
          <button
            type="button"
            className="back-link"
            onClick={() => navigate("/collections")}
          >
            ← Continue Shopping
          </button>
        </div>
      </div>

      {/* 4. Main Cart Content */}
      <main className="cart-page-main">
        <div className="cart-page-header">
          <span className="cart-page-eyebrow">CURATED SELECTIONS</span>
          <h1 className="cart-page-title">
            Your Shopping Bag <span className="cart-count-indicator">({cart.totalItems || 0})</span>
          </h1>
        </div>

        {/* Unauthenticated State */}
        {!user ? (
          <div className="cart-unauth-card">
            <span className="unauth-icon">♙</span>
            <h2>Sign in to view your shopping bag</h2>
            <p>Access your saved flacons and reserve your luxury extraits.</p>
            <button
              type="button"
              className="cart-primary-action-btn"
              onClick={() => navigate("/login")}
            >
              SIGN IN TO YOUR ACCOUNT
            </button>
          </div>
        ) : !cart.items || cart.items.length === 0 ? (
          /* Empty Bag State */
          <div className="cart-empty-page-card">
            <span className="empty-cart-icon">⚗️</span>
            <h2>Your bag is currently empty</h2>
            <p>
              Your atelier bag contains no fragrances yet. Explore our handcrafted Men, Women, and Unisex collections to discover your signature scent.
            </p>
            <button
              type="button"
              className="cart-primary-action-btn"
              onClick={() => navigate("/collections")}
            >
              EXPLORE COLLECTIONS →
            </button>
          </div>
        ) : (
          /* Two-Column Cart View */
          <div className="cart-grid-layout">
            {/* Left Column: Items Table */}
            <div className="cart-items-table-col">
              <div className="cart-free-shipping-card">
                <div className="shipping-text-row">
                  {cart.qualifiesForFreeShipping ? (
                    <span className="qualified-text">✓ Your order qualifies for complimentary white-glove shipping.</span>
                  ) : (
                    <span>
                      Add <strong>{formatPrice(cart.amountForFreeShipping)}</strong> more to receive complimentary atelier shipping.
                    </span>
                  )}
                </div>
                <div className="shipping-bar-track">
                  <div
                    className={`shipping-bar-fill ${cart.qualifiesForFreeShipping ? "complete" : ""}`}
                    style={{ width: `${freeShippingProgress}%` }}
                  />
                </div>
              </div>

              <div className="cart-table-wrapper">
                <table className="cart-table">
                  <thead>
                    <tr>
                      <th className="th-product">FRAGRANCE</th>
                      <th className="th-price">PRICE</th>
                      <th className="th-qty">QUANTITY</th>
                      <th className="th-total">TOTAL</th>
                      <th className="th-remove"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.items.map((item) => {
                      const imgSrc = getImageUrl(item.primaryImage);
                      const maxAllowed = Math.min(item.stock, 5);
                      const isMaxLimit = item.quantity >= maxAllowed;
                      const itemKey = item._id || `${item.productId}-${item.variantId || "default"}`;
                      const itemIdentifier = item._id || item.productId;

                      return (
                        <tr key={itemKey} className="cart-row-item">
                          {/* Product Info */}
                          <td className="td-product">
                            <div className="table-product-media" onClick={() => navigate(`/products/${item.productId}`)}>
                              {imgSrc ? (
                                <img src={imgSrc} alt={item.name} />
                              ) : (
                                <div className="table-img-fallback">
                                  <span>FEXA</span>
                                </div>
                              )}
                            </div>
                            <div className="table-product-info">
                              <span className="table-brand">{item.brand || "FEXA"}</span>
                              <h3
                                className="table-name"
                                onClick={() => navigate(`/products/${item.productId}`)}
                              >
                                {item.name}
                              </h3>
                              <span className="table-cat">{item.category} Portfolio • Size: {item.volumeMl ? `${item.volumeMl} ml` : "100 ml"}</span>
                              {item.isInactive && (
                                <span className="table-alert-pill error">Unavailable</span>
                              )}
                              {item.isOutOfStock && (
                                <span className="table-alert-pill error">Out of stock</span>
                              )}
                            </div>
                          </td>

                          {/* Unit Price */}
                          <td className="td-price">
                            <span className="price-val">{formatPrice(item.price)}</span>
                          </td>

                          {/* Quantity Widget */}
                          <td className="td-qty">
                            <div className="table-qty-widget">
                              <button
                                type="button"
                                className="table-qty-btn"
                                onClick={() => updateQuantity(itemIdentifier, item.quantity - 1, item.variantId)}
                                disabled={item.quantity <= 1 || actionLoading}
                              >
                                −
                              </button>
                              <span className="table-qty-num">{item.quantity}</span>
                              <button
                                type="button"
                                className="table-qty-btn"
                                onClick={() => {
                                  if (item.quantity < maxAllowed) {
                                    updateQuantity(itemIdentifier, item.quantity + 1, item.variantId);
                                  }
                                }}
                                disabled={isMaxLimit || item.isOutOfStock || actionLoading}
                              >
                                +
                              </button>
                            </div>
                            {item.quantity >= 5 ? (
                              <small className="table-stock-limit">Max 5 per size</small>
                            ) : isMaxLimit ? (
                              <small className="table-stock-limit">Max {item.stock}</small>
                            ) : null}
                          </td>

                          {/* Total */}
                          <td className="td-total">
                            <span className="total-val">{formatPrice(item.itemTotal)}</span>
                          </td>

                          {/* Remove */}
                          <td className="td-remove">
                            <button
                              type="button"
                              className="table-remove-btn"
                              onClick={() => setItemToRemove(item)}
                              title="Remove item"
                              aria-label={`Remove ${item.name} from bag`}
                              disabled={actionLoading}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Actions */}
              <div className="cart-table-actions-row">
                <button
                  type="button"
                  className="cart-clear-btn"
                  onClick={handleClearBag}
                >
                  Clear Entire Bag
                </button>
                <button
                  type="button"
                  className="cart-continue-btn"
                  onClick={() => navigate("/collections")}
                >
                  ← Continue Shopping
                </button>
              </div>
            </div>

            {/* Right Column: Order Summary Card */}
            <div className="cart-summary-col">
              <div className="order-summary-card">
                <h2 className="summary-card-title">ORDER SUMMARY</h2>

                <div className="summary-breakdown">
                  <div className="breakdown-row">
                    <span>Subtotal ({cart.totalItems} items)</span>
                    <span className="breakdown-num">{formatPrice(cart.subtotal)}</span>
                  </div>

                  <div className="breakdown-row">
                    <span>Atelier Climate-Control Shipping</span>
                    <span className="breakdown-num">
                      {cart.qualifiesForFreeShipping ? "COMPLIMENTARY" : "Calculated at Checkout"}
                    </span>
                  </div>

                  <div className="breakdown-row">
                    <span>Taxes</span>
                    <span className="breakdown-num">INCLUDED</span>
                  </div>

                  <div className="summary-divider" />

                  <div className="summary-total-row">
                    <span className="total-label">ESTIMATED TOTAL</span>
                    <span className="total-val">{formatPrice(cart.subtotal)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="summary-checkout-btn"
                  onClick={() => navigate("/checkout")}
                >
                  PROCEED TO CHECKOUT →
                </button>

                <div className="summary-reassurance-box">
                  <div className="reassurance-item">
                    <span className="reassurance-icon">⚜️</span>
                    <div>
                      <strong>Haute Provenance</strong>
                      <p>Direct from Grasse botanical extraction ateliers.</p>
                    </div>
                  </div>

                  <div className="reassurance-item">
                    <span className="reassurance-icon">📦</span>
                    <div>
                      <strong>Climate-Controlled Packaging</strong>
                      <p>Insulated against temperature variations.</p>
                    </div>
                  </div>

                  <div className="reassurance-item">
                    <span className="reassurance-icon">🎁</span>
                    <div>
                      <strong>Complimentary 2ml Vial</strong>
                      <p>Curated discovery sample included with every flacon.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 5. Footer */}
      <footer className="cart-page-footer">
        <div className="footer-container">
          <span>© {new Date().getFullYear()} FEXA HAUTE PARFUMERIE. ALL RIGHTS RESERVED.</span>
          <span>CRAFTED WITH QUIET RESTRAINT.</span>
        </div>
      </footer>

      {/* Remove Confirmation Popup Modal */}
      {itemToRemove && (
        <div
          className="cart-remove-modal-backdrop"
          onClick={() => setItemToRemove(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-page-remove-title"
        >
          <div
            className="cart-remove-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="remove-modal-icon">🗑</div>
            <h3 id="cart-page-remove-title" className="remove-modal-title">
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
    </div>
  );
}

export default Cart;
