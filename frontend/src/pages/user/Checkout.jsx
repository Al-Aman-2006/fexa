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

  // Coupon state
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState(null);
  const [couponSuccess, setCouponSuccess] = useState(null);
  const [availableOffers, setAvailableOffers] = useState([]);
  const [showOffersDrawer, setShowOffersDrawer] = useState(false);
  const [loadingOffers, setLoadingOffers] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState("Razorpay");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);

  // Dedicated states for Razorpay failure, cancellation, interrupted verification, and order reuse
  const [failedOrder, setFailedOrder] = useState(null);
  const [pendingVerification, setPendingVerification] = useState(null);
  const [activeInternalOrderId, setActiveInternalOrderId] = useState(null);
  const [cancellationNotice, setCancellationNotice] = useState(null);
  const [isVerifyingPending, setIsVerifyingPending] = useState(false);

  // Dynamically load Razorpay checkout script if not already present
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existingScript) {
        existingScript.onload = () => resolve(true);
        existingScript.onerror = () => resolve(false);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

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
    fetchAvailableOffers();
  }, []);

  // When window gains focus (e.g. user returns from adding an address in Profile), re-fetch
  useEffect(() => {
    const handleFocus = () => {
      fetchSavedAddresses();
      fetchAvailableOffers();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const selectedAddress = addresses.find((a) => a._id === selectedAddressId) || null;

  // Fetch active eligible offers for customer discovery
  const fetchAvailableOffers = async () => {
    try {
      setLoadingOffers(true);
      const token = localStorage.getItem("token");
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("http://localhost:5000/api/coupons/available", {
        method: "GET",
        headers,
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAvailableOffers(data.coupons || []);
      }
    } catch (err) {
      console.error("Fetch available offers error:", err);
    } finally {
      setLoadingOffers(false);
    }
  };

  // Authoritatively apply single coupon against backend
  const handleApplyCoupon = async (codeToApply) => {
    const code = (codeToApply || couponInput || "").trim().toUpperCase();
    if (!code) {
      setCouponError("Please enter a valid coupon code.");
      return;
    }
    try {
      setCouponLoading(true);
      setCouponError(null);
      setCouponSuccess(null);

      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("http://localhost:5000/api/coupons/apply", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ couponCode: code }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.coupon) {
        setAppliedCoupon(data.coupon);
        setCouponSuccess(`Coupon ${data.coupon.code} applied successfully! You save ${formatPrice(data.coupon.discountAmount)} (${data.coupon.discountPercentage}% OFF).`);
        setCouponInput("");
        setShowOffersDrawer(false);
      } else {
        // PRESERVE valid existing coupon if replacement code fails validation (Rule 5 & Test E)
        setCouponError(data.message || "Invalid coupon code.");
      }
    } catch (err) {
      console.error("Apply coupon error:", err);
      setCouponError("Unable to apply coupon. Please check your network connection.");
    } finally {
      setCouponLoading(false);
    }
  };

  // Remove currently applied coupon and revert checkout totals
  const handleRemoveCoupon = async () => {
    try {
      setCouponLoading(true);
      setCouponError(null);
      setCouponSuccess(null);

      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("http://localhost:5000/api/coupons/remove", {
        method: "POST",
        headers,
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAppliedCoupon(null);
        setCouponSuccess("Coupon removed successfully.");
      } else {
        setAppliedCoupon(null);
      }
    } catch (err) {
      console.error("Remove coupon error:", err);
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  // Derived financial summary (Server authoritative)
  const subtotal = cart.subtotal || 0;
  const shippingCost = cart.qualifiesForFreeShipping ? 0 : 250;
  const discountAmount = appliedCoupon ? Math.min(subtotal, appliedCoupon.discountAmount || 0) : 0;
  const finalPayableTotal = Math.max(0, subtotal - discountAmount + shippingCost);

  // Helper to record payment failure reasons on backend safely without stock deduction
  const recordBackendFailure = async (orderId, rzpOrderId, rzpPaymentId, code, description) => {
    try {
      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch("http://localhost:5000/api/orders/razorpay/payment-failed", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          orderId,
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: rzpPaymentId || null,
          code: code || "PAYMENT_FAILED",
          description: description || "Payment was not completed.",
        }),
      });
    } catch (err) {
      console.warn("Could not report payment failure to backend:", err);
    }
  };

  // Dedicated Razorpay initialization supporting order reuse to prevent duplicates
  const initiateRazorpayCheckout = async (existingOrderId = null) => {
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      setError("Unable to load Razorpay payment gateway. Please check your internet connection.");
      setIsSubmitting(false);
      return;
    }

    const token = localStorage.getItem("token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // Create or reuse internal order and Razorpay order
    const rzpInitRes = await fetch("http://localhost:5000/api/orders/razorpay/create-order", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({
        addressId: selectedAddressId,
        orderId: existingOrderId || activeInternalOrderId || undefined,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      }),
    });

    const rzpInitData = await rzpInitRes.json();
    if (!rzpInitRes.ok || !rzpInitData.success) {
      setError(rzpInitData.message || "Failed to initialize payment gateway.");
      setIsSubmitting(false);
      return;
    }

    const internalOrderId = rzpInitData.orderId;
    const internalOrderNumber = rzpInitData.orderNumber;
    setActiveInternalOrderId(internalOrderId);

    const razorpayKey =
      rzpInitData.keyId ||
      import.meta.env.VITE_RAZORPAY_KEY_ID ||
      "rzp_test_TqUYTgZOU4T32M";

    const options = {
      key: razorpayKey,
      amount: rzpInitData.amount,
      currency: rzpInitData.currency || "INR",
      name: "FEXA Haute Parfumerie",
      description: "Fragrance Order Dispatch & Reservation",
      order_id: rzpInitData.razorpayOrderId,
      prefill: {
        name: rzpInitData.customer?.name || selectedAddress.fullName || user?.name || "",
        email: rzpInitData.customer?.email || user?.email || "",
        contact: rzpInitData.customer?.phone || selectedAddress.phone || user?.phone || "",
      },
      notes: {
        address: `${selectedAddress.house || ""}, ${selectedAddress.street || ""}, ${selectedAddress.city || ""}`,
        internalOrderId: internalOrderId,
      },
      theme: {
        color: "#6a4f82",
      },
      modal: {
        ondismiss: function () {
          setIsSubmitting(false);
          recordBackendFailure(
            internalOrderId,
            rzpInitData.razorpayOrderId,
            null,
            "MODAL_DISMISSED",
            "Customer closed payment window without completing payment."
          );
          setCancellationNotice(
            "Payment window was closed. Your shopping bag and delivery details have been preserved. You can retry payment when ready or choose Cash on Delivery."
          );
        },
      },
      handler: async function (response) {
        try {
          setIsSubmitting(true);
          setCancellationNotice(null);

          const verifyRes = await fetch("http://localhost:5000/api/orders/razorpay/verify-payment", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({
              orderId: internalOrderId,
              addressId: selectedAddressId,
              paymentMethod: "Razorpay",
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          const verifyData = await verifyRes.json();
          if (verifyRes.ok && verifyData.success && verifyData.order) {
            setCompletedOrder(verifyData.order);
            setFailedOrder(null);
            setPendingVerification(null);
            setActiveInternalOrderId(null);
            if (fetchCart) fetchCart();
          } else {
            // Cryptographic verification failed
            setFailedOrder({
              orderId: internalOrderId,
              orderNumber: internalOrderNumber,
              totalAmount: finalPayableTotal,
              reason: verifyData.message || "Payment signature verification failed. Please contact boutique concierge.",
              code: "SIGNATURE_VERIFICATION_FAILED",
              paymentId: response.razorpay_payment_id || null,
              items: cart.items || [],
              subtotal: cart.subtotal,
              discountAmount: discountAmount,
              couponCode: appliedCoupon ? appliedCoupon.code : null,
              shippingCost: cart.qualifiesForFreeShipping ? 0 : 250,
            });
          }
        } catch (verErr) {
          console.error("Verification network interruption:", verErr);
          // Interrupted request / unconfirmed status state
          setPendingVerification({
            orderId: internalOrderId,
            orderNumber: internalOrderNumber,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            amount: finalPayableTotal,
          });
        } finally {
          setIsSubmitting(false);
        }
      },
    };

    const razorpayPopup = new window.Razorpay(options);
    razorpayPopup.on("payment.failed", function (failResp) {
      console.error("Razorpay payment failed:", failResp.error);
      const errReason = failResp.error?.description || "Payment was declined by your bank or payment method.";
      const errCode = failResp.error?.code || "PAYMENT_FAILED";
      const errPaymentId = failResp.error?.metadata?.payment_id || null;

      recordBackendFailure(
        internalOrderId,
        rzpInitData.razorpayOrderId,
        errPaymentId,
        errCode,
        errReason
      );

      setFailedOrder({
        orderId: internalOrderId,
        orderNumber: internalOrderNumber,
        totalAmount: finalPayableTotal,
        reason: errReason,
        code: errCode,
        paymentId: errPaymentId,
        items: cart.items || [],
        subtotal: cart.subtotal,
        discountAmount: discountAmount,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        shippingCost: cart.qualifiesForFreeShipping ? 0 : 250,
      });
      setIsSubmitting(false);
    });

    razorpayPopup.open();
  };

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
      setCancellationNotice(null);

      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // ========================================================
      // 1. RAZORPAY GATEWAY PAYMENT FLOW
      // ========================================================
      if (paymentMethod === "Razorpay" || paymentMethod === "Card") {
        await initiateRazorpayCheckout(activeInternalOrderId);
        return;
      }

      // ========================================================
      // 2. CASH ON DELIVERY (COD) FLOW (safely reuses existing order if available)
      // ========================================================
      const res = await fetch("http://localhost:5000/api/orders", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          addressId: selectedAddressId,
          paymentMethod: "COD",
          orderId: activeInternalOrderId || undefined,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.order) {
        setCompletedOrder(data.order);
        setActiveInternalOrderId(null);
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

  // Re-attempt payment safely reusing existing internal order
  const handleRetryRazorpay = async () => {
    setFailedOrder(null);
    setCancellationNotice(null);
    setError(null);
    setIsSubmitting(true);
    await initiateRazorpayCheckout(activeInternalOrderId || (failedOrder && failedOrder.orderId));
  };

  // Convert failed online order to Cash on Delivery without creating duplicates
  const handleSwitchToCOD = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("http://localhost:5000/api/orders", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          addressId: selectedAddressId,
          paymentMethod: "COD",
          orderId: activeInternalOrderId || (failedOrder && failedOrder.orderId) || undefined,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.order) {
        setCompletedOrder(data.order);
        setFailedOrder(null);
        setActiveInternalOrderId(null);
        if (fetchCart) fetchCart();
      } else {
        setError(data.message || "Failed to switch order to Cash on Delivery.");
      }
    } catch (err) {
      console.error("Switch to COD error:", err);
      setError("Unable to connect to order server. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToCheckout = () => {
    setFailedOrder(null);
    setCancellationNotice(null);
    setError(null);
  };

  // Handle network interruption / unconfirmed status retry
  const handleRetryVerification = async () => {
    if (!pendingVerification) return;
    try {
      setIsVerifyingPending(true);
      setError(null);
      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // 1. Try verify-payment first with signature
      const verifyRes = await fetch("http://localhost:5000/api/orders/razorpay/verify-payment", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          orderId: pendingVerification.orderId,
          addressId: selectedAddressId,
          paymentMethod: "Razorpay",
          razorpay_order_id: pendingVerification.razorpayOrderId,
          razorpay_payment_id: pendingVerification.razorpayPaymentId,
          razorpay_signature: pendingVerification.razorpaySignature,
        }),
      });

      const verifyData = await verifyRes.json();
      if (verifyRes.ok && verifyData.success && verifyData.order) {
        setCompletedOrder(verifyData.order);
        setPendingVerification(null);
        setActiveInternalOrderId(null);
        if (fetchCart) fetchCart();
        return;
      }

      // 2. Check status directly from order controller
      const statusRes = await fetch(`http://localhost:5000/api/orders/razorpay/check-status/${pendingVerification.orderId}`, {
        headers,
        credentials: "include",
      });
      const statusData = await statusRes.json();
      if (statusRes.ok && statusData.success && statusData.order && statusData.order.paymentStatus === "Paid") {
        setCompletedOrder(statusData.order);
        setPendingVerification(null);
        setActiveInternalOrderId(null);
        if (fetchCart) fetchCart();
      } else {
        setError("Could not confirm payment capture yet. If your account was debited, your order will automatically be marked Paid via webhook shortly.");
      }
    } catch (err) {
      console.error("Retry verification error:", err);
      setError("Network error while communicating with atelier. Please check your internet connection.");
    } finally {
      setIsVerifyingPending(false);
    }
  };

  // ========================================================
  // VIEW: 1. COMPLETED ORDER CONFIRMATION
  // ========================================================
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
                    {it.allocatedCouponDiscount > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: "2px" }}>
                        <span style={{ textDecoration: "line-through", color: "#9ca3af", fontSize: "0.75rem" }}>
                          {formatPrice(it.originalLineAmount || it.lineTotal)}
                        </span>
                        <span style={{ color: "#a855f7", fontSize: "0.72rem", fontWeight: 700 }}>
                          -{formatPrice(it.allocatedCouponDiscount)}
                        </span>
                        <strong style={{ color: "#10b981", fontSize: "0.95rem" }}>
                          {formatPrice(it.discountedLineAmount || (it.lineTotal - it.allocatedCouponDiscount))}
                        </strong>
                      </div>
                    ) : (
                      <strong>{formatPrice(it.lineTotal)}</strong>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="confirmed-summary-footer">
              <div className="conf-row">
                <span>Subtotal</span>
                <span>{formatPrice(completedOrder.subtotal)}</span>
              </div>
              {completedOrder.totalOfferDiscount > 0 && (
                <div className="conf-row" style={{ color: "#7c3aed", fontWeight: 700 }}>
                  <span>Automatic Offer Savings</span>
                  <span>-{formatPrice(completedOrder.totalOfferDiscount)}</span>
                </div>
              )}
              {completedOrder.discountAmount > 0 && (
                <div className="conf-row" style={{ color: "#059669", fontWeight: 700 }}>
                  <span>Coupon Discount ({completedOrder.couponCode} • {completedOrder.discountPercentage}% OFF)</span>
                  <span>-{formatPrice(completedOrder.discountAmount)}</span>
                </div>
              )}
              <div className="conf-row">
                <span>Shipping</span>
                <span>{completedOrder.shippingCost === 0 ? "COMPLIMENTARY" : formatPrice(completedOrder.shippingCost)}</span>
              </div>
              <div className="conf-row">
                <span>Payment Method</span>
                <span>{completedOrder.paymentMethod === "COD" ? "Cash on Delivery" : "Razorpay Secure Gateway"}</span>
              </div>
              <div className="conf-row">
                <span>Payment Status</span>
                <span style={{ color: completedOrder.paymentStatus === "Paid" ? "#10b981" : "#f59e0b", fontWeight: 700 }}>
                  {completedOrder.paymentStatus === "Paid" ? "✓ PAID & CONFIRMED" : "PENDING (COD)"}
                </span>
              </div>
              {completedOrder.razorpayPaymentId && (
                <div className="conf-row">
                  <span>Razorpay Payment ID</span>
                  <span style={{ fontFamily: "monospace", fontSize: "0.82rem", color: "#6a4f82", fontWeight: 600 }}>
                    {completedOrder.razorpayPaymentId}
                  </span>
                </div>
              )}
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

  // ========================================================
  // VIEW: 2. UNCONFIRMED / INTERRUPTED STATUS (PENDING)
  // ========================================================
  if (pendingVerification) {
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
          <div className="order-pending-card">
            <div className="pending-seal-icon">⏳</div>
            <span className="pending-eyebrow">PAYMENT VERIFICATION INTERRUPTED</span>
            <h2 className="pending-title">Confirming Transaction</h2>
            <p className="pending-subtext">
              Your payment authorization was completed with Razorpay, but our atelier was momentarily unable to verify the signature signal due to a network interruption. Please re-check or verify your order status before re-paying.
            </p>

            <div className="pending-details-box">
              <div className="pending-row">
                <span>Atelier Manifest</span>
                <code>{pendingVerification.orderNumber || pendingVerification.orderId}</code>
              </div>
              {pendingVerification.razorpayPaymentId && (
                <div className="pending-row">
                  <span>Razorpay Payment ID</span>
                  <code>{pendingVerification.razorpayPaymentId}</code>
                </div>
              )}
              <div className="pending-row">
                <span>Transaction Amount</span>
                <strong>{formatPrice(pendingVerification.amount)}</strong>
              </div>
            </div>

            {error && (
              <div className="checkout-error-banner" role="alert" style={{ marginBottom: "1.5rem" }}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="pending-actions-row">
              <button
                type="button"
                className="pending-verify-btn"
                onClick={handleRetryVerification}
                disabled={isVerifyingPending}
              >
                {isVerifyingPending ? "VERIFYING WITH ATELIER..." : "RE-CHECK PAYMENT STATUS NOW →"}
              </button>
              <button
                type="button"
                className="pending-orders-link-btn"
                onClick={() => navigate("/profile", { state: { activeTab: "orders" } })}
              >
                VIEW MY ORDERS IN PROFILE →
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ========================================================
  // VIEW: 3. DEDICATED PAYMENT FAILURE SCREEN
  // ========================================================
  if (failedOrder) {
    return (
      <div className="fexa-checkout-page">
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

        <main className="checkout-main-container">
          <div className="order-failed-card">
            <div className="failed-seal-icon">⚠️</div>
            <span className="failed-eyebrow">PAYMENT TRANSACTION UNSUCCESSFUL</span>
            <h2 className="failed-title">Payment Could Not Be Completed</h2>
            <p className="failed-order-number">
              ATELIER RESERVED MANIFEST: <strong>{failedOrder.orderNumber}</strong>
            </p>

            <div className="failed-reason-box">
              <div className="failed-reason-header">
                <span className="failed-reason-badge">{failedOrder.code || "TRANSACTION_DECLINED"}</span>
                <span className="failed-reason-step">Security & Authorization Check</span>
              </div>
              <p className="failed-reason-text">{failedOrder.reason}</p>
              {failedOrder.paymentId && (
                <div className="failed-payment-id">
                  <span>Razorpay Ref:</span>
                  <code>{failedOrder.paymentId}</code>
                </div>
              )}
            </div>

            <div className="failed-preservation-notice">
              <span className="notice-icon">🛍️</span>
              <div className="notice-text">
                <strong>Your shopping bag & reserved address remain untouched</strong>
                <p>
                  No payment was debited. You can immediately retry payment with another card, UPI, or NetBanking, or switch seamlessly to Cash on Delivery.
                </p>
              </div>
            </div>

            {error && (
              <div className="checkout-error-banner" role="alert" style={{ marginBottom: "1.5rem" }}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="failed-actions-container">
              <button
                type="button"
                className="failed-retry-primary-btn"
                onClick={handleRetryRazorpay}
                disabled={isSubmitting}
              >
                {isSubmitting ? "PREPARING PAYMENT GATEWAY..." : "RETRY PAYMENT WITH RAZORPAY →"}
              </button>
              <button
                type="button"
                className="failed-cod-secondary-btn"
                onClick={handleSwitchToCOD}
                disabled={isSubmitting}
              >
                {isSubmitting ? "CONVERTING TO COD..." : "SWITCH TO CASH ON DELIVERY (COD) →"}
              </button>
              <div className="failed-aux-links">
                <button
                  type="button"
                  className="failed-aux-link"
                  onClick={handleBackToCheckout}
                >
                  Return to Checkout Details
                </button>
                <span className="aux-divider">•</span>
                <Link to="/cart" className="failed-aux-link">
                  Review Shopping Bag
                </Link>
                <span className="aux-divider">•</span>
                <Link to="/profile" className="failed-aux-link">
                  View Order History
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ========================================================
  // VIEW: 4. MAIN CHECKOUT FORM
  // ========================================================
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

              {/* Cancellation Notice Banner */}
              {cancellationNotice && (
                <div className="checkout-cancellation-banner" role="status">
                  <div className="cancellation-banner-content">
                    <span className="banner-icon">ℹ️</span>
                    <span>{cancellationNotice}</span>
                  </div>
                  <button
                    type="button"
                    className="cancellation-dismiss-btn"
                    onClick={() => setCancellationNotice(null)}
                    title="Dismiss notice"
                  >
                    ✕
                  </button>
                </div>
              )}

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

                {/* APPLY COUPON SECTION */}
                <div className="checkout-coupon-section">
                  <div className="coupon-section-header">
                    <div className="coupon-section-title-group">
                      <span className="coupon-icon">🏷️</span>
                      <h3>APPLY COUPON</h3>
                    </div>
                    <button
                      type="button"
                      className="coupon-offers-toggle-btn"
                      onClick={() => {
                        fetchAvailableOffers();
                        setShowOffersDrawer(true);
                      }}
                    >
                      View Offers ↗
                    </button>
                  </div>

                  {appliedCoupon ? (
                    <div className="coupon-applied-card">
                      <div className="coupon-applied-left">
                        <span className="coupon-applied-seal">⚜️</span>
                        <div className="coupon-applied-details">
                          <div className="coupon-applied-top-row">
                            <span className="applied-code-badge">{appliedCoupon.code}</span>
                            <span className="applied-pct-tag">{appliedCoupon.discountPercentage}% OFF</span>
                          </div>
                          <span className="applied-savings-text">
                            Saved <strong>{formatPrice(appliedCoupon.discountAmount)}</strong> on your eligible perfume order
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="coupon-remove-btn"
                        onClick={handleRemoveCoupon}
                        disabled={couponLoading}
                        title="Remove this coupon"
                      >
                        {couponLoading ? "REMOVING..." : "REMOVE"}
                      </button>
                    </div>
                  ) : (
                    <div className="coupon-input-group">
                      <input
                        type="text"
                        className="coupon-code-input"
                        placeholder="Enter coupon code (e.g. FEXA20)"
                        value={couponInput}
                        onChange={(e) => {
                          setCouponInput(e.target.value.toUpperCase());
                          if (couponError) setCouponError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleApplyCoupon();
                          }
                        }}
                        disabled={couponLoading}
                      />
                      <button
                        type="button"
                        className="coupon-apply-btn"
                        onClick={() => handleApplyCoupon()}
                        disabled={couponLoading || !couponInput.trim()}
                      >
                        {couponLoading ? "APPLYING..." : "APPLY"}
                      </button>
                    </div>
                  )}

                  {couponError && (
                    <div className="coupon-inline-feedback error">
                      <span>⚠️</span>
                      <span>{couponError}</span>
                    </div>
                  )}
                  {couponSuccess && !couponError && (
                    <div className="coupon-inline-feedback success">
                      <span>✓</span>
                      <span>{couponSuccess}</span>
                    </div>
                  )}
                </div>

                {/* PAYMENT METHOD SECTION */}
                <div className="payment-method-section">
                  <span className="payment-section-title">PAYMENT METHOD</span>
                  <div className="payment-options-row">
                    <label className={`payment-option-card ${paymentMethod === "Razorpay" ? "active" : ""}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="Razorpay"
                        checked={paymentMethod === "Razorpay"}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                      <div className="payment-card-body">
                        <div className="payment-card-title-row">
                          <strong>Razorpay (Cards, UPI, NetBanking)</strong>
                          <span className="rzp-pill-badge">SECURE</span>
                        </div>
                        <small>Instant encrypted checkout via Razorpay Gateway</small>
                      </div>
                    </label>

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
                    ? "COMMUNICATING WITH ATELIER..."
                    : addresses.length === 0 && !loadingAddresses
                    ? "ADD DELIVERY ADDRESS IN PROFILE TO ORDER"
                    : paymentMethod === "Razorpay"
                    ? `PROCEED TO PAY ${formatPrice(finalPayableTotal)} VIA RAZORPAY →`
                    : "PLACE ORDER WITH CASH ON DELIVERY"}
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
                  cart.items.map((item) => {
                    const alloc = appliedCoupon?.itemAllocations?.find(
                      (a) =>
                        (item.variantId && String(a.variantId) === String(item.variantId)) ||
                        (item.productId && String(a.productId) === String(item.productId)) ||
                        (item._id && String(a._id) === String(item._id))
                    );
                    const lineDiscount = alloc
                      ? alloc.allocatedCouponDiscount
                      : appliedCoupon && discountAmount > 0 && subtotal > 0
                      ? Math.round((item.itemTotal * discountAmount) / subtotal)
                      : 0;
                    const netLineAmount = alloc
                      ? alloc.discountedLineAmount
                      : item.itemTotal - lineDiscount;

                    return (
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
                            {item.appliedOffer && (
                              <span
                                style={{
                                  display: "block",
                                  color: "#7c3aed",
                                  fontWeight: 700,
                                  fontSize: "0.75rem",
                                  marginTop: "2px",
                                }}
                              >
                                🏷️ {item.appliedOffer.name}
                              </span>
                            )}
                          </small>
                          <div className="chk-pricing-line">
                            <span className="chk-unit-sub">{formatPrice(item.price)} × {item.quantity}</span>
                            {lineDiscount > 0 ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ textDecoration: "line-through", color: "#9ca3af", fontSize: "0.78rem" }}>
                                  {formatPrice(item.itemTotal)}
                                </span>
                                <span style={{ background: "rgba(168, 85, 247, 0.12)", color: "#a855f7", fontSize: "0.72rem", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                  -{formatPrice(lineDiscount)}
                                </span>
                                <span className="chk-price" style={{ color: "#10b981" }}>
                                  {formatPrice(netLineAmount)}
                                </span>
                              </div>
                            ) : (
                              <span className="chk-price">{formatPrice(item.itemTotal)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="chk-empty-note">No items currently in your shopping bag.</p>
                )}
              </div>

              <div className="chk-totals-block">
                {cart.totalOfferDiscount > 0 && (
                  <>
                    <div className="chk-row">
                      <span>Original Subtotal</span>
                      <span style={{ textDecoration: "line-through", color: "#9ca3af" }}>
                        {formatPrice(cart.originalSubtotal)}
                      </span>
                    </div>
                    <div className="chk-row" style={{ color: "#10b981", fontWeight: 600 }}>
                      <span>Automatic Promotional Savings</span>
                      <span style={{ color: "#10b981", fontWeight: 700 }}>
                        -{formatPrice(cart.totalOfferDiscount)}
                      </span>
                    </div>
                  </>
                )}
                <div className="chk-row">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {appliedCoupon && discountAmount > 0 && (
                  <div className="chk-row discount-row">
                    <span>Coupon ({appliedCoupon.code} • {appliedCoupon.discountPercentage}% OFF)</span>
                    <span className="discount-val">-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="chk-row">
                  <span>Shipping</span>
                  <span>{cart.qualifiesForFreeShipping ? "COMPLIMENTARY" : formatPrice(shippingCost)}</span>
                </div>
                <div className="conf-divider" />
                <div className="chk-row total">
                  <span>Total Amount</span>
                  <span className="total-val">
                    {formatPrice(finalPayableTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* OFFERS DRAWER MODAL */}
      {showOffersDrawer && (
        <div className="offers-modal-overlay" onClick={() => setShowOffersDrawer(false)}>
          <div className="offers-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="offers-modal-header">
              <h3>🏷️ EXCLUSIVE ATELIER OFFERS</h3>
              <button
                type="button"
                className="offers-modal-close-btn"
                onClick={() => setShowOffersDrawer(false)}
                title="Close offers"
              >
                ✕
              </button>
            </div>

            <div className="offers-modal-body">
              {loadingOffers ? (
                <div className="chk-address-loading">
                  <div className="chk-spinner" />
                  <span>Discovering eligible boutique offers...</span>
                </div>
              ) : availableOffers.length === 0 ? (
                <div className="offers-empty-state">
                  <p>No active public offers available at this moment. Check back soon for exclusive boutique promotions.</p>
                </div>
              ) : (
                availableOffers.map((offer) => {
                  const isApplied = appliedCoupon && appliedCoupon.code === offer.code;
                  const meetsMin = !offer.minimumOrderAmount || subtotal >= offer.minimumOrderAmount;
                  return (
                    <div key={offer._id || offer.code} className="offer-card">
                      <div className="offer-card-details">
                        <div className="offer-code-row">
                          <span className="offer-code-pill">{offer.code}</span>
                          <span className="offer-pct-tag">{offer.discountPercentage}% OFF</span>
                        </div>
                        <div className="offer-title">{offer.name || "Exclusive Perfume Offer"}</div>
                        {offer.description && (
                          <p className="offer-description">{offer.description}</p>
                        )}
                        <div className="offer-terms-sub">
                          {offer.minimumOrderAmount > 0 && (
                            <span>Min. order: {formatPrice(offer.minimumOrderAmount)} • </span>
                          )}
                          {offer.maximumDiscount > 0 && (
                            <span>Max discount: {formatPrice(offer.maximumDiscount)} • </span>
                          )}
                          {offer.expiryDate && (
                            <span>Valid until {new Date(offer.expiryDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="offer-apply-card-btn"
                        onClick={() => handleApplyCoupon(offer.code)}
                        disabled={couponLoading || isApplied || !meetsMin}
                      >
                        {isApplied ? "APPLIED" : !meetsMin ? `MIN ${formatPrice(offer.minimumOrderAmount)}` : "APPLY"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

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
