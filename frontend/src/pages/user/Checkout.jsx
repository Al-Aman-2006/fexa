import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { validateAddressField, validateAddressForm } from "../../utils/validation";
import { getAddresses, addAddress, getWalletBalance } from "../../services/user.service.js";
import { createOrder } from "../../services/order.service.js";
import {
  getAvailableCoupons,
  applyCoupon,
  removeCoupon,
  recordPaymentFailure,
  createRazorpayOrder,
  verifyRazorpayPayment,
  checkOrderStatus,
} from "../../services/payment.service.js";
import { getImageUrl } from "../../utils/imageUrl.js";
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

  // Inline Add Address Form states
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);
  const [addressFormData, setAddressFormData] = useState({
    fullName: "",
    phone: "",
    house: "",
    street: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    label: "Home",
    isDefault: false,
  });
  const [addressFieldErrors, setAddressFieldErrors] = useState({});
  const [addressTouched, setAddressTouched] = useState({});
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [saveAddressError, setSaveAddressError] = useState(null);

  // FEXA Wallet states
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState(null);
  const [walletInsufficientModal, setWalletInsufficientModal] = useState(null);

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

  // Fetch saved addresses belonging to authenticated user from Profile API
  const fetchSavedAddresses = async () => {
    try {
      setLoadingAddresses(true);
      setAddressError(null);

      const data = await getAddresses();
      if (data?.success) {
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
        setAddressError(data?.message || "Failed to load saved delivery addresses.");
      }
    } catch (err) {
      console.error("Fetch saved addresses error:", err);
      setAddressError(err.response?.data?.message || "Unable to connect to server to load saved addresses.");
    } finally {
      setLoadingAddresses(false);
    }
  };

  // Fetch current user wallet balance from backend
  const fetchWalletBalance = async () => {
    try {
      setWalletLoading(true);
      setWalletError(null);

      const data = await getWalletBalance();
      if (data?.success) {
        setWalletBalance(Number(data.balance || 0));
      } else {
        setWalletError(data?.message || "Failed to load wallet balance.");
      }
    } catch (err) {
      console.error("Fetch wallet balance error:", err);
      setWalletError(err.response?.data?.message || "Unable to connect to wallet server.");
    } finally {
      setWalletLoading(false);
    }
  };

  // Inline address form input handler with real-time blur/change validation
  const handleAddressInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;

    setAddressFormData((prev) => {
      const next = { ...prev, [name]: val };
      if (addressTouched[name]) {
        const fieldErr = validateAddressField(name, val, next);
        setAddressFieldErrors((prevErr) => ({ ...prevErr, [name]: fieldErr }));
      }
      return next;
    });
  };

  const handleAddressInputBlur = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    setAddressTouched((prev) => ({ ...prev, [name]: true }));
    const fieldErr = validateAddressField(name, val, addressFormData);
    setAddressFieldErrors((prevErr) => ({ ...prevErr, [name]: fieldErr }));
  };

  // Save new delivery address directly to user profile in MongoDB from Checkout
  const handleSaveNewAddress = async (e) => {
    e.preventDefault();
    setSaveAddressError(null);

    const validation = validateAddressForm(addressFormData);
    if (!validation.isValid) {
      setAddressFieldErrors(validation.errors);
      const touchedAll = {};
      Object.keys(addressFormData).forEach((k) => (touchedAll[k] = true));
      setAddressTouched(touchedAll);
      return;
    }

    try {
      setIsSavingAddress(true);

      const data = await addAddress(validation.normalizedData || addressFormData);
      if (data?.success) {
        const updatedList = data.addresses || [];
        setAddresses(updatedList);

        // Auto-select the newly added address
        if (updatedList.length > 0) {
          const newlyAdded = updatedList[updatedList.length - 1];
          setSelectedAddressId(newlyAdded._id);
        }

        // Close inline form and reset
        setShowAddAddressForm(false);
        setIsChangingAddress(false);
        setAddressFormData({
          fullName: "",
          phone: "",
          house: "",
          street: "",
          city: "",
          state: "",
          pincode: "",
          country: "India",
          label: "Home",
          isDefault: false,
        });
        setAddressFieldErrors({});
        setAddressTouched({});
      } else {
        setSaveAddressError(data?.message || "Failed to save address.");
        if (data?.errors) {
          setAddressFieldErrors(data.errors);
        }
      }
    } catch (err) {
      console.error("Save address error:", err);
      const data = err.response?.data;
      if (data?.errors) {
        setAddressFieldErrors(data.errors);
      }
      setSaveAddressError(data?.message || "Unable to connect to server. Please try again.");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleCancelAddAddress = () => {
    setShowAddAddressForm(false);
    setSaveAddressError(null);
    setAddressFieldErrors({});
    setAddressTouched({});
  };

  useEffect(() => {
    fetchSavedAddresses();
    fetchAvailableOffers();
    fetchWalletBalance();
  }, []);

  // When window gains focus or wallet is updated elsewhere, re-fetch
  useEffect(() => {
    const handleFocus = () => {
      fetchSavedAddresses();
      fetchAvailableOffers();
      fetchWalletBalance();
    };
    const handleWalletUpdated = (e) => {
      if (e.detail && e.detail.newBalance !== undefined) {
        setWalletBalance(Number(e.detail.newBalance));
      } else {
        fetchWalletBalance();
      }
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("fexa:wallet-updated", handleWalletUpdated);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("fexa:wallet-updated", handleWalletUpdated);
    };
  }, []);

  const selectedAddress = addresses.find((a) => a._id === selectedAddressId) || null;

  // Fetch active eligible offers for customer discovery
  const fetchAvailableOffers = async () => {
    try {
      setLoadingOffers(true);
      const data = await getAvailableCoupons();
      if (data && data.success) {
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

      const data = await applyCoupon({ couponCode: code });
      if (data && data.success && data.coupon) {
        setAppliedCoupon(data.coupon);
        setCouponSuccess(`Coupon ${data.coupon.code} applied successfully! You save ${formatPrice(data.coupon.discountAmount)} (${data.coupon.discountPercentage}% OFF).`);
        setCouponInput("");
        setShowOffersDrawer(false);
      } else {
        // PRESERVE valid existing coupon if replacement code fails validation (Rule 5 & Test E)
        setCouponError(data?.message || "Invalid coupon code.");
      }
    } catch (err) {
      console.error("Apply coupon error:", err);
      setCouponError(err.response?.data?.message || "Unable to apply coupon. Please check your network connection.");
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

      const data = await removeCoupon();
      if (data && data.success) {
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
      await recordPaymentFailure({
        orderId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId || null,
        code: code || "PAYMENT_FAILED",
        description: description || "Payment was not completed.",
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

    // Create or reuse internal order and Razorpay order
    let rzpInitData;
    try {
      rzpInitData = await createRazorpayOrder({
        addressId: selectedAddressId,
        orderId: existingOrderId || activeInternalOrderId || undefined,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      });
    } catch (initErr) {
      console.error("Razorpay order creation error:", initErr);
      setError(initErr.response?.data?.message || "Failed to initialize payment gateway.");
      setIsSubmitting(false);
      return;
    }

    if (!rzpInitData || !rzpInitData.success) {
      setError(rzpInitData?.message || "Failed to initialize payment gateway.");
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

          const verifyData = await verifyRazorpayPayment({
            orderId: internalOrderId,
            addressId: selectedAddressId,
            paymentMethod: "Razorpay",
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });

          if (verifyData && verifyData.success && verifyData.order) {
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
              reason: verifyData?.message || "Payment signature verification failed. Please contact boutique concierge.",
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
      setError("Please select or add a valid delivery address above to complete your order.");
      const addrEl = document.querySelector(".checkout-address-section");
      if (addrEl) addrEl.scrollIntoView({ behavior: "smooth" });
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
      // 2. FEXA WALLET PAYMENT FLOW
      // ========================================================
      if (paymentMethod === "Wallet") {
        if (walletBalance < finalPayableTotal) {
          const shortfall = Math.max(0, finalPayableTotal - walletBalance);
          setWalletInsufficientModal({
            availableBalance: walletBalance,
            requiredAmount: finalPayableTotal,
            shortfall,
          });
          setIsSubmitting(false);
          return;
        }

        let data;
        try {
          data = await createOrder({
            addressId: selectedAddressId,
            paymentMethod: "Wallet",
            orderId: activeInternalOrderId || undefined,
            couponCode: appliedCoupon ? appliedCoupon.code : undefined,
          });
        } catch (walletErr) {
          data = walletErr.response?.data;
          if (!data) throw walletErr;
        }

        if (data && data.success && data.order) {
          const updatedBalance = data.walletTransaction?.newBalance !== undefined
            ? Number(data.walletTransaction.newBalance)
            : Math.max(0, walletBalance - finalPayableTotal);

          setWalletBalance(updatedBalance);
          setCompletedOrder({
            ...data.order,
            walletTransaction: data.walletTransaction || {
              transactionId: data.order.walletTransactionId,
              amount: data.order.totalAmount,
              balanceBefore: walletBalance,
              balanceAfter: updatedBalance,
              newBalance: updatedBalance,
            },
          });
          setActiveInternalOrderId(null);
          setWalletInsufficientModal(null);

          // Broadcast live wallet balance update to all open components & tabs
          window.dispatchEvent(
            new CustomEvent("fexa:wallet-updated", {
              detail: { newBalance: updatedBalance },
            })
          );

          if (fetchCart) fetchCart();
        } else {
          if (data?.errorType === "INSUFFICIENT_WALLET_BALANCE" || data?.shortfall !== undefined) {
            setWalletInsufficientModal({
              availableBalance: Number(data.walletBalance ?? walletBalance),
              requiredAmount: Number(data.requiredAmount ?? finalPayableTotal),
              shortfall: Number(data.shortfall ?? Math.max(0, finalPayableTotal - walletBalance)),
            });
            if (data.walletBalance !== undefined) {
              setWalletBalance(Number(data.walletBalance));
            }
          } else {
            setError(data?.message || "Failed to process wallet payment. Please try again.");
          }
        }
        return;
      }

      // ========================================================
      // 3. CASH ON DELIVERY (COD) FLOW (safely reuses existing order if available)
      // ========================================================
      let data;
      try {
        data = await createOrder({
          addressId: selectedAddressId,
          paymentMethod: "COD",
          orderId: activeInternalOrderId || undefined,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        });
      } catch (codErr) {
        data = codErr.response?.data;
        if (!data) throw codErr;
      }

      if (data && data.success && data.order) {
        setCompletedOrder(data.order);
        setActiveInternalOrderId(null);
        if (fetchCart) fetchCart();
      } else {
        setError(data?.message || "Failed to process your order. Please try again.");
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

      let data;
      try {
        data = await createOrder({
          addressId: selectedAddressId,
          paymentMethod: "COD",
          orderId: activeInternalOrderId || (failedOrder && failedOrder.orderId) || undefined,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        });
      } catch (codErr) {
        data = codErr.response?.data;
        if (!data) throw codErr;
      }

      if (data && data.success && data.order) {
        setCompletedOrder(data.order);
        setFailedOrder(null);
        setActiveInternalOrderId(null);
        if (fetchCart) fetchCart();
      } else {
        setError(data?.message || "Failed to switch order to Cash on Delivery.");
      }
    } catch (err) {
      console.error("Switch to COD error:", err);
      setError("Unable to connect to order server. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert failed online order to Wallet payment without creating duplicates
  const handleSwitchToWallet = async () => {
    if (walletBalance < finalPayableTotal) {
      setError("Insufficient wallet balance to cover order total.");
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);

      let data;
      try {
        data = await createOrder({
          addressId: selectedAddressId,
          paymentMethod: "Wallet",
          orderId: activeInternalOrderId || (failedOrder && failedOrder.orderId) || undefined,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        });
      } catch (wErr) {
        data = wErr.response?.data;
        if (!data) throw wErr;
      }

      if (data && data.success && data.order) {
        setCompletedOrder(data.order);
        setFailedOrder(null);
        setActiveInternalOrderId(null);
        fetchWalletBalance();
        if (fetchCart) fetchCart();
      } else {
        setError(data?.message || "Failed to switch order to Wallet payment.");
      }
    } catch (err) {
      console.error("Switch to wallet error:", err);
      setError("Network interruption switching payment method.");
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

      // 1. Try verify-payment first with signature
      try {
        const verifyData = await verifyRazorpayPayment({
          orderId: pendingVerification.orderId,
          addressId: selectedAddressId,
          paymentMethod: "Razorpay",
          razorpay_order_id: pendingVerification.razorpayOrderId,
          razorpay_payment_id: pendingVerification.razorpayPaymentId,
          razorpay_signature: pendingVerification.razorpaySignature,
        });

        if (verifyData && verifyData.success && verifyData.order) {
          setCompletedOrder(verifyData.order);
          setPendingVerification(null);
          setActiveInternalOrderId(null);
          if (fetchCart) fetchCart();
          return;
        }
      } catch (sigErr) {
        console.warn("Signature re-verification attempt note:", sigErr);
      }

      // 2. Check status directly from order controller
      try {
        const statusData = await checkOrderStatus(pendingVerification.orderId);
        if (statusData && statusData.success && statusData.order && statusData.order.paymentStatus === "Paid") {
          setCompletedOrder(statusData.order);
          setPendingVerification(null);
          setActiveInternalOrderId(null);
          if (fetchCart) fetchCart();
        } else {
          setError("Could not confirm payment capture yet. If your account was debited, your order will automatically be marked Paid via webhook shortly.");
        }
      } catch (statusErr) {
        setError(statusErr.response?.data?.message || "Could not confirm payment capture yet. If your account was debited, your order will automatically be marked Paid via webhook shortly.");
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
            {completedOrder.paymentMethod === "Wallet" ? (
              <div className="wallet-payment-success-header">
                <div className="confirmed-seal-icon" style={{ fontSize: "2.6rem", marginBottom: "8px" }}>✨👛✨</div>
                <span className="confirmed-eyebrow" style={{ color: "#059669", background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
                  PAYMENT SUCCESSFUL • FEXA WALLET
                </span>
                <h2 className="confirmed-title" style={{ marginTop: "12px" }}>Payment Successful!</h2>
                <p className="confirmed-order-number">
                  ORDER ID: <strong>{completedOrder.orderNumber}</strong>
                </p>
                <p className="confirmed-subtext">
                  Your purchase has been debited seamlessly from your FEXA Atelier Wallet. Your flacons are now locked into reservation.
                </p>

                {/* DEDICATED WALLET TRANSACTION BREAKDOWN CARD */}
                <div className="wallet-success-receipt-box">
                  <div className="receipt-box-header">
                    <span>FEXA WALLET TRANSACTION RECEIPT</span>
                    <span className="receipt-status-pill">● SUCCESSFUL</span>
                  </div>
                  <div className="receipt-rows-container">
                    <div className="receipt-row">
                      <span>Order ID</span>
                      <strong>{completedOrder.orderNumber}</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Payment Method</span>
                      <strong>FEXA Wallet</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Amount Paid</span>
                      <strong style={{ color: "#059669", fontSize: "0.95rem" }}>
                        {formatPrice(completedOrder.totalAmount)}
                      </strong>
                    </div>
                    <div className="receipt-row">
                      <span>Wallet Transaction Reference</span>
                      <span className="receipt-monospace">
                        {completedOrder.walletTransactionId || completedOrder.walletTransaction?.transactionId || `TXN-WLT-${completedOrder.orderNumber}`}
                      </span>
                    </div>
                    <div className="receipt-row">
                      <span>Payment Date</span>
                      <span>
                        {new Date(completedOrder.paidAt || completedOrder.createdAt || Date.now()).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="receipt-divider" />
                    <div className="receipt-row">
                      <span>Previous Wallet Balance</span>
                      <span>{formatPrice(completedOrder.walletTransaction?.balanceBefore ?? (walletBalance + completedOrder.totalAmount))}</span>
                    </div>
                    <div className="receipt-row deduct">
                      <span>Amount Deducted</span>
                      <span className="deduct-val">-{formatPrice(completedOrder.walletTransaction?.amount ?? completedOrder.totalAmount)}</span>
                    </div>
                    <div className="receipt-divider" />
                    <div className="receipt-row net-balance">
                      <span>Remaining Wallet Balance</span>
                      <strong className="net-val">
                        {formatPrice(completedOrder.walletTransaction?.balanceAfter ?? walletBalance)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="confirmed-seal-icon">⚜️</div>
                <span className="confirmed-eyebrow">ORDER CONFIRMED & RESERVED</span>
                <h2 className="confirmed-title">Thank You For Your Order</h2>
                <p className="confirmed-order-number">
                  ATELIER DISPATCH MANIFEST: <strong>{completedOrder.orderNumber}</strong>
                </p>
                <p className="confirmed-subtext">
                  Your artisanal fragrances have been reserved directly in our Grasse vault. Each flacon is being prepared in our climate-stabilized atelier.
                </p>
              </>
            )}

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
                <span>
                  {completedOrder.paymentMethod === "COD"
                    ? "Cash on Delivery"
                    : completedOrder.paymentMethod === "Wallet"
                    ? "FEXA Wallet"
                    : "Razorpay Secure Gateway"}
                </span>
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

            <div className="confirmed-actions-row" style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "24px" }}>
              <button
                type="button"
                className="checkout-return-btn"
                onClick={() => navigate("/collections")}
              >
                CONTINUE SHOPPING →
              </button>
              <button
                type="button"
                className="checkout-bag-btn"
                onClick={() => navigate("/profile", { state: { activeTab: "orders" } })}
              >
                VIEW ORDER DETAILS →
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
                        {showAddAddressForm
                          ? "New Delivery Destination"
                          : isChangingAddress
                          ? "Select a Saved Address"
                          : "Delivery Destination"}
                      </h3>
                    </div>

                    {!loadingAddresses && (
                      <div className="chk-address-header-actions">
                        {!showAddAddressForm && (
                          <button
                            type="button"
                            className="chk-header-add-btn"
                            onClick={() => {
                              setShowAddAddressForm(true);
                              setIsChangingAddress(false);
                            }}
                          >
                            + ADD NEW ADDRESS
                          </button>
                        )}
                        {showAddAddressForm && (
                          <button
                            type="button"
                            className="chk-header-cancel-btn"
                            onClick={handleCancelAddAddress}
                          >
                            ✕ Cancel
                          </button>
                        )}
                        {addresses.length > 1 && !showAddAddressForm && (
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

                  {/* INLINE ADD ADDRESS FORM DIRECTLY IN CHECKOUT */}
                  {showAddAddressForm && (
                    <div className="chk-inline-address-form-card">
                      <div className="chk-address-form-header">
                        <div>
                          <span className="chk-form-eyebrow">NEW DESTINATION</span>
                          <h4 className="chk-form-heading">Add Delivery Address</h4>
                        </div>
                        <button
                          type="button"
                          className="chk-form-close-btn"
                          onClick={handleCancelAddAddress}
                          disabled={isSavingAddress}
                          title="Close form"
                        >
                          ✕
                        </button>
                      </div>

                      {saveAddressError && (
                        <div className="chk-form-server-error" role="alert">
                          <span>⚠️ {saveAddressError}</span>
                        </div>
                      )}

                      <div className="chk-address-form-grid">
                        {/* Full Name */}
                        <div className="chk-form-field">
                          <label className="chk-form-label">
                            Full Name <span className="required-star">*</span>
                          </label>
                          <input
                            type="text"
                            name="fullName"
                            value={addressFormData.fullName}
                            onChange={handleAddressInputChange}
                            onBlur={handleAddressInputBlur}
                            placeholder="e.g. Alistair Vance"
                            className={`chk-form-input ${addressFieldErrors.fullName && addressTouched.fullName ? "input-error" : ""}`}
                            disabled={isSavingAddress}
                          />
                          {addressFieldErrors.fullName && addressTouched.fullName && (
                            <span className="chk-field-error-text">{addressFieldErrors.fullName}</span>
                          )}
                        </div>

                        {/* Mobile Number */}
                        <div className="chk-form-field">
                          <label className="chk-form-label">
                            Mobile Number <span className="required-star">*</span>
                          </label>
                          <div className={`chk-phone-input-wrap ${addressFieldErrors.phone && addressTouched.phone ? "input-error" : ""}`}>
                            <span className="chk-country-prefix">+91</span>
                            <input
                              type="tel"
                              name="phone"
                              value={addressFormData.phone}
                              onChange={handleAddressInputChange}
                              onBlur={handleAddressInputBlur}
                              placeholder="10-digit mobile number"
                              className="chk-form-input"
                              disabled={isSavingAddress}
                            />
                          </div>
                          {addressFieldErrors.phone && addressTouched.phone && (
                            <span className="chk-field-error-text">{addressFieldErrors.phone}</span>
                          )}
                        </div>

                        {/* Flat / House / Building */}
                        <div className="chk-form-field">
                          <label className="chk-form-label">
                            House / Building Name <span className="required-star">*</span>
                          </label>
                          <input
                            type="text"
                            name="house"
                            value={addressFormData.house}
                            onChange={handleAddressInputChange}
                            onBlur={handleAddressInputBlur}
                            placeholder="e.g. Suite 4B, Imperial Residency"
                            className={`chk-form-input ${addressFieldErrors.house && addressTouched.house ? "input-error" : ""}`}
                            disabled={isSavingAddress}
                          />
                          {addressFieldErrors.house && addressTouched.house && (
                            <span className="chk-field-error-text">{addressFieldErrors.house}</span>
                          )}
                        </div>

                        {/* Street / Locality */}
                        <div className="chk-form-field">
                          <label className="chk-form-label">
                            Street Address / Locality <span className="required-star">*</span>
                          </label>
                          <input
                            type="text"
                            name="street"
                            value={addressFormData.street}
                            onChange={handleAddressInputChange}
                            onBlur={handleAddressInputBlur}
                            placeholder="e.g. Park Avenue, Near Botanical Gardens"
                            className={`chk-form-input ${addressFieldErrors.street && addressTouched.street ? "input-error" : ""}`}
                            disabled={isSavingAddress}
                          />
                          {addressFieldErrors.street && addressTouched.street && (
                            <span className="chk-field-error-text">{addressFieldErrors.street}</span>
                          )}
                        </div>

                        {/* City */}
                        <div className="chk-form-field">
                          <label className="chk-form-label">
                            City <span className="required-star">*</span>
                          </label>
                          <input
                            type="text"
                            name="city"
                            value={addressFormData.city}
                            onChange={handleAddressInputChange}
                            onBlur={handleAddressInputBlur}
                            placeholder="e.g. Mumbai"
                            className={`chk-form-input ${addressFieldErrors.city && addressTouched.city ? "input-error" : ""}`}
                            disabled={isSavingAddress}
                          />
                          {addressFieldErrors.city && addressTouched.city && (
                            <span className="chk-field-error-text">{addressFieldErrors.city}</span>
                          )}
                        </div>

                        {/* State */}
                        <div className="chk-form-field">
                          <label className="chk-form-label">
                            State <span className="required-star">*</span>
                          </label>
                          <input
                            type="text"
                            name="state"
                            value={addressFormData.state}
                            onChange={handleAddressInputChange}
                            onBlur={handleAddressInputBlur}
                            placeholder="e.g. Maharashtra"
                            className={`chk-form-input ${addressFieldErrors.state && addressTouched.state ? "input-error" : ""}`}
                            disabled={isSavingAddress}
                          />
                          {addressFieldErrors.state && addressTouched.state && (
                            <span className="chk-field-error-text">{addressFieldErrors.state}</span>
                          )}
                        </div>

                        {/* PIN Code */}
                        <div className="chk-form-field">
                          <label className="chk-form-label">
                            PIN Code <span className="required-star">*</span>
                          </label>
                          <input
                            type="text"
                            name="pincode"
                            value={addressFormData.pincode}
                            onChange={handleAddressInputChange}
                            onBlur={handleAddressInputBlur}
                            placeholder="6-digit PIN code"
                            maxLength={6}
                            className={`chk-form-input ${addressFieldErrors.pincode && addressTouched.pincode ? "input-error" : ""}`}
                            disabled={isSavingAddress}
                          />
                          {addressFieldErrors.pincode && addressTouched.pincode && (
                            <span className="chk-field-error-text">{addressFieldErrors.pincode}</span>
                          )}
                        </div>

                        {/* Country */}
                        <div className="chk-form-field">
                          <label className="chk-form-label">
                            Country <span className="required-star">*</span>
                          </label>
                          <input
                            type="text"
                            name="country"
                            value={addressFormData.country}
                            onChange={handleAddressInputChange}
                            onBlur={handleAddressInputBlur}
                            placeholder="e.g. India"
                            className={`chk-form-input ${addressFieldErrors.country && addressTouched.country ? "input-error" : ""}`}
                            disabled={isSavingAddress}
                          />
                          {addressFieldErrors.country && addressTouched.country && (
                            <span className="chk-field-error-text">{addressFieldErrors.country}</span>
                          )}
                        </div>

                        {/* Address Type (Label) */}
                        <div className="chk-form-field chk-grid-span-2">
                          <label className="chk-form-label">Address Type</label>
                          <div className="chk-address-type-selector">
                            {["Home", "Work", "Other"].map((lbl) => (
                              <button
                                type="button"
                                key={lbl}
                                className={`chk-type-chip ${addressFormData.label === lbl ? "active" : ""}`}
                                onClick={() => setAddressFormData((prev) => ({ ...prev, label: lbl }))}
                              >
                                {lbl === "Home" ? "🏠 Home" : lbl === "Work" ? "💼 Work" : "📍 Other"}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Set Default */}
                        <div className="chk-form-field chk-grid-span-2 chk-form-checkbox-row">
                          <label className="chk-checkbox-label">
                            <input
                              type="checkbox"
                              name="isDefault"
                              checked={addressFormData.isDefault}
                              onChange={handleAddressInputChange}
                              disabled={isSavingAddress}
                            />
                            <span>Set as my default delivery address</span>
                          </label>
                        </div>

                        {/* Form action buttons */}
                        <div className="chk-form-actions-row chk-grid-span-2">
                          <button
                            type="button"
                            className="chk-btn-cancel"
                            onClick={handleCancelAddAddress}
                            disabled={isSavingAddress}
                          >
                            CANCEL
                          </button>
                          <button
                            type="button"
                            className="chk-btn-submit"
                            onClick={handleSaveNewAddress}
                            disabled={isSavingAddress}
                          >
                            {isSavingAddress ? "SAVING DESTINATION..." : "SAVE & DELIVER HERE →"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* NO ADDRESSES SAVED (EMPTY STATE) */}
                  {!loadingAddresses && !addressError && addresses.length === 0 && !showAddAddressForm && (
                    <div className="chk-empty-address-card">
                      <div className="chk-empty-icon">📍</div>
                      <h4 className="chk-empty-title">No delivery address found. Please add your delivery address to continue.</h4>
                      <p className="chk-empty-subtext">
                        You do not have any delivery addresses saved in your profile yet.
                        Please add your delivery destination below to complete your order.
                      </p>
                      <div className="chk-empty-actions">
                        <button
                          type="button"
                          className="chk-primary-add-btn"
                          onClick={() => setShowAddAddressForm(true)}
                        >
                          + ADD DELIVERY ADDRESS →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SAVED ADDRESS CARDS GRID (When user chooses CHANGE ADDRESS) */}
                  {!loadingAddresses && !addressError && addresses.length > 0 && isChangingAddress && !showAddAddressForm && (
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

                      {/* Add new address card inside the grid */}
                      <div
                        className="chk-address-card add-card"
                        onClick={() => {
                          setShowAddAddressForm(true);
                          setIsChangingAddress(false);
                        }}
                      >
                        <div className="chk-add-card-inner">
                          <span className="chk-add-card-icon">➕</span>
                          <span className="chk-add-card-title">Add New Address</span>
                          <span className="chk-add-card-sub">Deliver to another home or office</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SELECTED ADDRESS SUMMARY VIEW (When not in list mode and not adding) */}
                  {!loadingAddresses && !addressError && addresses.length > 0 && !isChangingAddress && !showAddAddressForm && selectedAddress && (
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
                  <div className="payment-section-header">
                    <span className="payment-section-title">PAYMENT METHOD</span>
                    {paymentMethod === "Wallet" && (
                      <span className="wallet-live-badge">
                        Wallet Balance: {formatPrice(walletBalance)}
                      </span>
                    )}
                  </div>

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
                        <div className="payment-card-title-row">
                          <strong>Cash on Delivery (COD)</strong>
                        </div>
                        <small>Pay concierge upon white-glove arrival</small>
                      </div>
                    </label>

                    <label className={`payment-option-card ${paymentMethod === "Wallet" ? "active" : ""}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="Wallet"
                        checked={paymentMethod === "Wallet"}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                      <div className="payment-card-body">
                        <div className="payment-card-title-row">
                          <strong>FEXA Wallet</strong>
                          <span className={`wlt-pill-badge ${walletBalance >= finalPayableTotal ? "sufficient" : "low"}`}>
                            {walletLoading ? "CHECKING..." : formatPrice(walletBalance)}
                          </span>
                        </div>
                        <small>Instant debited checkout from your atelier wallet balance</small>
                      </div>
                    </label>
                  </div>

                  {/* FEXA Wallet Details & Breakdown when Wallet is selected */}
                  {paymentMethod === "Wallet" && (
                    <div className="checkout-wallet-details-card">
                      <div className="wallet-details-title-row">
                        <span className="wlt-icon">💼</span>
                        <strong>FEXA WALLET PAYMENT BREAKDOWN</strong>
                      </div>

                      <div className="wlt-breakdown-table">
                        <div className="wlt-breakdown-row">
                          <span>Available Wallet Balance</span>
                          <span className="wlt-val-bold">{formatPrice(walletBalance)}</span>
                        </div>
                        <div className="wlt-breakdown-row">
                          <span>Final Checkout Total</span>
                          <span className="wlt-val-bold">{formatPrice(finalPayableTotal)}</span>
                        </div>
                        <div className="wlt-breakdown-row wlt-deduct-row">
                          <span>Amount to be Deducted</span>
                          <span className="wlt-deduct-val">-{formatPrice(finalPayableTotal)}</span>
                        </div>
                        <div className="wlt-breakdown-divider" />
                        <div className="wlt-breakdown-row wlt-net-row">
                          <span>Remaining Balance After Payment</span>
                          <span className={`wlt-net-val ${walletBalance >= finalPayableTotal ? "positive" : "negative"}`}>
                            {walletBalance >= finalPayableTotal
                              ? formatPrice(walletBalance - finalPayableTotal)
                              : formatPrice(0)}
                          </span>
                        </div>
                      </div>

                      {walletBalance < finalPayableTotal ? (
                        <div className="wlt-insufficient-alert">
                          <span className="wlt-alert-icon">⚠️</span>
                          <div>
                            <strong>Insufficient Wallet Balance</strong>
                            <p>
                              You need {formatPrice(finalPayableTotal - walletBalance)} more in your wallet to complete this order. Please select Razorpay or Cash on Delivery, or top up your wallet in your profile.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="wlt-sufficient-notice">
                          <span className="wlt-check-icon">✓</span>
                          <span>Your wallet has sufficient balance. Order total of {formatPrice(finalPayableTotal)} will be seamlessly debited upon confirmation.</span>
                        </div>
                      )}
                    </div>
                  )}
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

                {/* Inline submit error banner right above the action button */}
                {error && (
                  <div
                    className="checkout-action-error-banner"
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      padding: "12px 16px",
                      borderRadius: "8px",
                      marginBottom: "16px",
                      fontSize: "14px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="checkout-place-order-btn"
                  disabled={
                    isSubmitting ||
                    !cart.items ||
                    cart.items.length === 0 ||
                    loadingAddresses ||
                    !selectedAddressId ||
                    (paymentMethod === "Wallet" && walletBalance < finalPayableTotal)
                  }
                >
                  {isSubmitting
                    ? "COMMUNICATING WITH ATELIER..."
                    : addresses.length === 0 && !loadingAddresses
                    ? "ADD DELIVERY ADDRESS TO ORDER"
                    : paymentMethod === "Wallet"
                    ? walletBalance < finalPayableTotal
                      ? "INSUFFICIENT WALLET BALANCE"
                      : `PAY ${formatPrice(finalPayableTotal)} WITH FEXA WALLET →`
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

      {/* INSUFFICIENT WALLET BALANCE MODAL */}
      {walletInsufficientModal && (
        <div className="offers-modal-overlay" onClick={() => setWalletInsufficientModal(null)}>
          <div className="wallet-insufficient-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="wlt-fail-header">
              <div className="wlt-fail-title-group">
                <span className="wlt-fail-badge-icon">⚠️</span>
                <h3 className="wlt-fail-modal-title">Payment Failed – Insufficient Wallet Balance</h3>
              </div>
              <button
                type="button"
                className="offers-modal-close-btn"
                onClick={() => setWalletInsufficientModal(null)}
                title="Dismiss"
              >
                ✕
              </button>
            </div>

            <p className="wlt-fail-modal-desc">
              Your FEXA Wallet does not have enough balance to complete this purchase. No money has been deducted from your wallet, and your shopping bag remains intact.
            </p>

            <div className="wlt-fail-metrics-table">
              <div className="wlt-fail-metric-row">
                <span>Available Wallet Balance:</span>
                <strong className="metric-bold">{formatPrice(walletInsufficientModal.availableBalance)}</strong>
              </div>
              <div className="wlt-fail-metric-row">
                <span>Required Order Total:</span>
                <strong className="metric-bold">{formatPrice(walletInsufficientModal.requiredAmount)}</strong>
              </div>
              <div className="wlt-fail-metric-divider" />
              <div className="wlt-fail-metric-row shortfall">
                <span>Shortfall to Complete Purchase:</span>
                <strong className="shortfall-amount">{formatPrice(walletInsufficientModal.shortfall)}</strong>
              </div>
            </div>

            <div className="wlt-fail-actions-container">
              <span className="wlt-actions-title">CHOOSE HOW TO PROCEED:</span>
              <button
                type="button"
                className="wlt-fail-btn topup-btn"
                onClick={() => navigate("/profile", { state: { activeTab: "wallet" } })}
              >
                💳 Add Money to Wallet in Profile →
              </button>
              <button
                type="button"
                className="wlt-fail-btn rzp-btn"
                onClick={() => {
                  setPaymentMethod("Razorpay");
                  setWalletInsufficientModal(null);
                }}
              >
                ⚡ Proceed with Razorpay (Cards, UPI, NetBanking)
              </button>
              <button
                type="button"
                className="wlt-fail-btn cod-btn"
                onClick={() => {
                  setPaymentMethod("COD");
                  setWalletInsufficientModal(null);
                }}
              >
                📦 Proceed with Cash on Delivery (COD)
              </button>
              <button
                type="button"
                className="wlt-fail-btn dismiss-btn"
                onClick={() => setWalletInsufficientModal(null)}
              >
                ← Return to Checkout
              </button>
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
