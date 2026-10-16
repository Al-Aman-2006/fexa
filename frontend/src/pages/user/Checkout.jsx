import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import "./Checkout.css";

function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, clearCart, fetchCart } = useCart();

  // Saved addresses state fetched from user Profile
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [addressError, setAddressError] = useState(null);
  const [isChangingAddress, setIsChangingAddress] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);

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

  // Fetch saved addresses belonging to authenticated user from Profile API
  const fetchSavedAddresses = async () => {
    try {
      setLoadingAddresses(true);
      setAddressError(null);

      const token = localStorage.getItem("token");
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("http://localhost:5000/api/profile/addresses", {
        method: "GET",
        headers,
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const list = data.addresses || [];
        setAddresses(list);
        if (list.length > 0) {
          // If a selected address already exists and is still in the list, retain it
          setSelectedAddressId((prevId) => {
            if (prevId && list.some((a) => a._id === prevId)) {
              return prevId;
            }
            // Auto-select default address if marked, otherwise select first valid address
            const defaultAddress = list.find((a) => a.isDefault);
            return defaultAddress ? defaultAddress._id : list[0]._id;
          });
        } else {
          setSelectedAddressId(null);
        }
      } else {
        setAddressError(data.message || "Failed to load saved delivery addresses.");
      }
    } catch (err) {
      console.error("Fetch saved addresses error:", err);
      setAddressError("Unable to connect to server to load saved addresses.");
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    fetchSavedAddresses();
  }, []);

  // When window gains focus (e.g. user returns from adding an address in Profile), re-fetch
  useEffect(() => {
    const handleFocus = () => {
      fetchSavedAddresses();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const selectedAddress = addresses.find((a) => a._id === selectedAddressId) || null;

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("Please sign in to complete your checkout.");
      return;
    }

    if (!cart.items || cart.items.length === 0) {
      setError("Your shopping bag is empty.");
      return;
    }

    if (!selectedAddressId || !selectedAddress) {
      setError("Please select a saved delivery address from your profile.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("http://localhost:5000/api/orders", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          addressId: selectedAddressId,
          paymentMethod,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.order) {
        setCompletedOrder(data.order);
        if (fetchCart) fetchCart();
      } else {
        setError(data.message || "Failed to process your order. Please try again.");
      }
    } catch (err) {
      console.error("Place order error:", err);
      setError("Unable to connect to order server. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // If order is completed, show beautiful Luxury Atelier Confirmation
  if (completedOrder) {
    return (
      <div className="fexa-checkout-page">
        <header className="checkout-navbar">
          <div className="checkout-navbar-inner">
            <div className="checkout-brand" onClick={() => navigate("/home")}>
              <h1>FEXA</h1>
              <span>HAUTE PARFUMERIE • ATELIER DISPATCH</span>
            </div>
            <Link to="/collections" className="checkout-back-link">
              ← Return to Boutique
            </Link>
          </div>
        </header>

        <main className="checkout-main-container">
          <div className="order-confirmed-card">
            <div className="confirmed-seal-icon">⚜️</div>
            <span className="confirmed-eyebrow">ORDER CONFIRMED & RESERVED</span>
            <h2 className="confirmed-title">Thank You For Your Order</h2>
            <p className="confirmed-order-number">
              ATELIER DISPATCH MANIFEST: <strong>{completedOrder.orderNumber}</strong>
            </p>
            <p className="confirmed-subtext">
              Your artisanal fragrances have been reserved directly in our Grasse vault. Each flacon is being prepared in our climate-stabilized atelier.
            </p>

            <div className="confirmed-items-list">
              <h3>PURCHASED FLACONS & FORMULATIONS</h3>
              {completedOrder.items.map((it) => (
                <div key={it._id} className="confirmed-item-row">
                  <div className="confirmed-item-info">
                    <strong>{it.name}</strong>
                    <span>
                      {it.brand || "FEXA"} • {it.category} • Size: {it.volumeMl} ml
                    </span>
                  </div>
                  <div className="confirmed-item-pricing">
                    <span>{formatPrice(it.unitPrice)} × {it.quantity}</span>
                    <strong>{formatPrice(it.lineTotal)}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="confirmed-summary-footer">
              <div className="conf-row">
                <span>Subtotal</span>
                <span>{formatPrice(completedOrder.subtotal)}</span>
              </div>
              <div className="conf-row">
                <span>Shipping</span>
                <span>{completedOrder.shippingCost === 0 ? "COMPLIMENTARY" : formatPrice(completedOrder.shippingCost)}</span>
              </div>
              <div className="conf-divider" />
              <div className="conf-row total">
                <span>Total Amount</span>
                <span>{formatPrice(completedOrder.totalAmount)}</span>
              </div>
            </div>

            <div className="confirmed-actions-row" style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "20px" }}>
              <button
                type="button"
                className="checkout-return-btn"
                onClick={() => navigate("/collections")}
              >
                EXPLORE MORE COLLECTIONS →
              </button>
              <button
                type="button"
                className="checkout-bag-btn"
                onClick={() => navigate("/profile", { state: { activeTab: "orders" } })}
              >
                VIEW IN MY ORDERS →
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fexa-checkout-page">
      {/* Top Navbar */}
      <header className="checkout-navbar">
        <div className="checkout-navbar-inner">
          <div className="checkout-brand" onClick={() => navigate("/home")}>
            <h1>FEXA</h1>
            <span>HAUTE PARFUMERIE • ATELIER DISPATCH</span>
          </div>
          <Link to="/cart" className="checkout-back-link">
            ← Return to Shopping Bag
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="checkout-main-container">
        <div className="checkout-grid">
          {/* Left Column: Shipping & Payment Form */}
          <div className="checkout-info-col">
            <div className="checkout-status-card">
              <div className="status-badge">⚜️ ELEVATED ATELIER DISPATCH</div>
              <h2>Shipping & Payment</h2>

              {error && (
                <div className="checkout-error-banner" role="alert">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handlePlaceOrder} className="checkout-form-body">
                {/* SAVED DELIVERY ADDRESS SECTION */}
                <div className="checkout-address-section">
                  <div className="checkout-address-header">
                    <div>
                      <span className="chk-section-eyebrow">DELIVERY ADDRESS</span>
                      <h3 className="chk-section-title">
                        {isChangingAddress ? "Select a Saved Address" : "Delivery Destination"}
                      </h3>
                    </div>

                    {addresses.length > 0 && !loadingAddresses && (
                      <div className="chk-address-header-actions">
                        {addresses.length > 1 && (
                          <button
                            type="button"
                            className="chk-header-action-btn"
                            onClick={() => setIsChangingAddress((prev) => !prev)}
                          >
                            {isChangingAddress ? "Done Selecting" : "CHANGE ADDRESS"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="chk-header-link-btn"
                          onClick={() => navigate("/profile", { state: { activeTab: "addresses", openAddressForm: true } })}
                          title="Manage addresses in Profile"
                        >
                          Manage in Profile ↗
                        </button>
                      </div>
                    )}
                  </div>

                  {/* LOADING STATE */}
                  {loadingAddresses && (
                    <div className="chk-address-loading">
                      <div className="chk-spinner" />
                      <span>Retrieving your saved addresses...</span>
                    </div>
                  )}

                  {/* ERROR STATE */}
                  {!loadingAddresses && addressError && (
                    <div className="chk-address-error-box">
                      <span>⚠️ {addressError}</span>
                      <button type="button" onClick={fetchSavedAddresses} className="chk-retry-btn">
                        Retry
                      </button>
                    </div>
                  )}

                  {/* NO ADDRESSES SAVED (EMPTY STATE) */}
                  {!loadingAddresses && !addressError && addresses.length === 0 && (
                    <div className="chk-no-address-card">
                      <div className="chk-no-address-icon">📍</div>
                      <h4>No saved delivery address found.</h4>
                      <p>
                        You do not have any delivery addresses saved in your profile yet.
                        Please add a delivery address to complete your order.
                      </p>
                      <button
                        type="button"
                        className="chk-add-address-profile-btn"
                        onClick={() => navigate("/profile", { state: { activeTab: "addresses", openAddressForm: true } })}
                      >
                        ADD ADDRESS IN PROFILE →
                      </button>
                    </div>
                  )}

                  {/* SAVED ADDRESS CARDS GRID (When user chooses CHANGE ADDRESS) */}
                  {!loadingAddresses && !addressError && addresses.length > 0 && isChangingAddress && (
                    <div className="chk-address-cards-grid">
                      {addresses.map((addr) => {
                        const isSelected = addr._id === selectedAddressId;
                        return (
                          <div
                            key={addr._id}
                            className={`chk-address-card ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              setSelectedAddressId(addr._id);
                              setIsChangingAddress(false);
                            }}
                          >
                            <div className="chk-card-top-row">
                              <div className="chk-card-tags">
                                <span className="chk-address-label-pill">{addr.label || "Home"}</span>
                                {addr.isDefault && <span className="chk-default-pill">DEFAULT</span>}
                              </div>
                              <span className={`chk-radio-indicator ${isSelected ? "checked" : ""}`}>
                                {isSelected ? "✓" : ""}
                              </span>
                            </div>

                            <h4 className="chk-card-name">{addr.fullName}</h4>
                            <p className="chk-card-phone">
                              <span>Phone:</span> {addr.phone}
                            </p>
                            <p className="chk-card-text">
                              {[addr.house, addr.street].filter(Boolean).join(", ")}
                              <br />
                              {addr.city}, {addr.state ? `${addr.state} - ` : ""}{addr.pincode}
                              <br />
                              {addr.country || "India"}
                            </p>

                            <button
                              type="button"
                              className={`chk-select-card-action ${isSelected ? "active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAddressId(addr._id);
                                setIsChangingAddress(false);
                              }}
                            >
                              {isSelected ? "DELIVERING HERE" : "SELECT THIS ADDRESS"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* SELECTED ADDRESS SUMMARY VIEW (When not in list mode) */}
                  {!loadingAddresses && !addressError && addresses.length > 0 && !isChangingAddress && selectedAddress && (
                    <div className="chk-selected-address-summary">
                      <div className="chk-summary-top">
                        <div className="chk-summary-label-group">
                          <span className="chk-summary-delivering-tag">DELIVERING TO</span>
                          <span className="chk-address-label-pill">{selectedAddress.label || "Home"}</span>
                          {selectedAddress.isDefault && (
                            <span className="chk-default-pill">DEFAULT</span>
                          )}
                        </div>
                        {addresses.length > 1 && (
                          <button
                            type="button"
                            className="chk-change-address-btn"
                            onClick={() => setIsChangingAddress(true)}
                          >
                            CHANGE ADDRESS
                          </button>
                        )}
                      </div>

                      <div className="chk-summary-details">
                        <h4 className="chk-summary-name">{selectedAddress.fullName}</h4>
                        <p className="chk-summary-phone">
                          <span>Phone:</span> <strong>{selectedAddress.phone}</strong>
                        </p>
                        <p className="chk-summary-location">
                          {[selectedAddress.house, selectedAddress.street].filter(Boolean).join(", ")}
                          <br />
                          {selectedAddress.city}, {selectedAddress.state ? `${selectedAddress.state} - ` : ""}{selectedAddress.pincode}
                          <br />
                          {selectedAddress.country || "India"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* PAYMENT METHOD SECTION */}
                <div className="payment-method-section">
                  <span className="payment-section-title">PAYMENT METHOD</span>
                  <div className="payment-options-row">
                    <label className={`payment-option-card ${paymentMethod === "COD" ? "active" : ""}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="COD"
                        checked={paymentMethod === "COD"}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                      <div className="payment-card-body">
                        <strong>Cash on Delivery (COD)</strong>
                        <small>Pay concierge upon white-glove arrival</small>
                      </div>
                    </label>

                    <label className={`payment-option-card ${paymentMethod === "Card" ? "active" : ""}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="Card"
                        checked={paymentMethod === "Card"}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                      <div className="payment-card-body">
                        <strong>Card / UPI / NetBanking</strong>
                        <small>Pre-authorized boutique payment</small>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="checkout-guarantee-list">
                  <div className="guarantee-row">
                    <span className="chk-icon">✓</span>
                    <span>Flacons reserved in real-time against live atelier inventory.</span>
                  </div>
                  <div className="guarantee-row">
                    <span className="chk-icon">✓</span>
                    <span>Direct provenance and pure botanical concentration guaranteed.</span>
                  </div>
                  <div className="guarantee-row">
                    <span className="chk-icon">✓</span>
                    <span>Complimentary 2ml discovery vial paired with each flacon.</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="checkout-place-order-btn"
                  disabled={
                    isSubmitting ||
                    !cart.items ||
                    cart.items.length === 0 ||
                    loadingAddresses ||
                    !selectedAddressId
                  }
                >
                  {isSubmitting
                    ? "PROCESSING DISPATCH..."
                    : addresses.length === 0 && !loadingAddresses
                    ? "ADD DELIVERY ADDRESS IN PROFILE TO ORDER"
                    : "PLACE ORDER WITH ATELIER DISPATCH"}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Order Summary Preview */}
          <div className="checkout-summary-col">
            <div className="checkout-summary-card">
              <h3>ORDER SUMMARY ({cart.totalItems || 0} ITEMS)</h3>

              <div className="checkout-items-preview">
                {cart.items && cart.items.length > 0 ? (
                  cart.items.map((item) => (
                    <div key={item._id || `${item.productId}-${item.variantId}`} className="chk-preview-item">
                      <div className="chk-preview-media">
                        {item.primaryImage ? (
                          <img src={getImageUrl(item.primaryImage)} alt={item.name} />
                        ) : (
                          <span>FEXA</span>
                        )}
                        <span className="chk-qty-badge">{item.quantity}</span>
                      </div>
                      <div className="chk-preview-details">
                        <h4>{item.name}</h4>
                        <small>
                          {item.brand || "FEXA"} • Size: {item.volumeMl ? `${item.volumeMl} ml` : "100 ml"}
                        </small>
                        <div className="chk-pricing-line">
                          <span className="chk-unit-sub">{formatPrice(item.price)} × {item.quantity}</span>
                          <span className="chk-price">{formatPrice(item.itemTotal)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="chk-empty-note">No items currently in your shopping bag.</p>
                )}
              </div>

              <div className="chk-totals-block">
                <div className="chk-row">
                  <span>Subtotal</span>
                  <span>{formatPrice(cart.subtotal)}</span>
                </div>
                <div className="chk-row">
                  <span>Shipping</span>
                  <span>{cart.qualifiesForFreeShipping ? "COMPLIMENTARY" : formatPrice(250)}</span>
                </div>
                <div className="chk-divider" />
                <div className="chk-row total">
                  <span>Total Amount</span>
                  <span className="total-val">
                    {formatPrice((cart.subtotal || 0) + (cart.qualifiesForFreeShipping ? 0 : 250))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* CHECKOUT FOOTER */}
      <footer className="checkout-footer">
        <div className="checkout-footer-inner">
          <span>© 2026 FEXA Haute Parfumerie. Concierge Dispatch & Encrypted Checkout.</span>
        </div>
      </footer>
    </div>
  );
}

export default Checkout;
