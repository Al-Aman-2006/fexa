import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import UserSidebar from "../../components/user/UserSidebar";
import Navbar from "../../components/common/Navbar";
import {
  validateAddressField,
  validateAddressForm,
  validateName,
  normalizeName,
  validateEmail,
  normalizeEmail,
  validateProfilePhone,
} from "../../utils/validation";

import "./profile.css";

const CANCELLATION_REASONS = [
  "Changed my mind",
  "Ordered by mistake",
  "Found a better price or offer",
  "Incorrect perfume size or volume selected",
  "Delivery time is too long",
  "Need to update delivery address",
  "Other",
];

const RETURN_REASONS = [
  "Product damaged",
  "Product leaked or packaging damaged",
  "Wrong product received",
  "Incorrect perfume variant or size received",
  "Product quality issue",
  "Product does not match the description",
  "Received an incorrect quantity",
  "Other",
];

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.onload = () => resolve(true);
      existing.onerror = () => resolve(false);
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

const getProfileImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  return `http://localhost:5000${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
};

const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  return `http://localhost:5000${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
};

const formatPrice = (val) => {
  if (val === undefined || val === null) return "₹0";
  return `₹${Number(val).toLocaleString("en-IN")}`;
};

function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser: setAuthUser, logout } = useAuth();
  const { cart, openCart } = useCart();
  const { wishlistCount, openWishlist } = useWishlist();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Navigation / Active tab state (reads location.state?.activeTab if redirected from Checkout)
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || "profile");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // ========================================
  // ORDERS STATE & FETCH
  // ========================================
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  const fetchOrders = async () => {
    try {
      setOrdersLoading(true);
      setOrdersError("");
      const token = localStorage.getItem("token");
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("http://localhost:5000/api/orders", {
        method: "GET",
        credentials: "include",
        headers,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setOrders(data.orders || []);
      } else {
        setOrdersError(data.message || "Failed to load orders.");
      }
    } catch (err) {
      console.error("Fetch orders error:", err);
      setOrdersError("Unable to retrieve order history.");
    } finally {
      setOrdersLoading(false);
    }
  };

  // ========================================
  // INVOICE STATE
  // ========================================
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState(null);

  // ========================================
  // WALLET STATE & OPERATIONS
  // ========================================
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTotalCredited, setWalletTotalCredited] = useState(0);
  const [walletTotalDebited, setWalletTotalDebited] = useState(0);
  const [walletCurrency, setWalletCurrency] = useState("INR");
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletTxPage, setWalletTxPage] = useState(1);
  const [walletTxPagination, setWalletTxPagination] = useState({ page: 1, totalPages: 1, totalTransactions: 0, limit: 10 });
  const [walletTxFilter, setWalletTxFilter] = useState("All");
  const [walletTxDirection, setWalletTxDirection] = useState("All");
  const [walletSearch, setWalletSearch] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpError, setTopUpError] = useState("");
  const [topUpProcessing, setTopUpProcessing] = useState(false);
  const [topUpSuccessModal, setTopUpSuccessModal] = useState(null);

  const fetchWalletData = useCallback(async () => {
    try {
      setWalletLoading(true);
      const token = localStorage.getItem("token");
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const params = new URLSearchParams({
        page: String(walletTxPage),
        limit: "10",
        type: walletTxFilter,
        direction: walletTxDirection,
      });
      if (walletSearch.trim()) params.append("search", walletSearch.trim());

      const [balRes, txRes] = await Promise.all([
        fetch("http://localhost:5000/api/wallet", {
          credentials: "include",
          headers,
        }),
        fetch(`http://localhost:5000/api/wallet/transactions?${params.toString()}`, {
          credentials: "include",
          headers,
        }),
      ]);

      const balData = await balRes.json();
      const txData = await txRes.json();

      if (balRes.ok && balData.success) {
        setWalletBalance(balData.balance || 0);
        setWalletTotalCredited(balData.totalCredited || 0);
        setWalletTotalDebited(balData.totalDebited || 0);
        setWalletCurrency(balData.currency || "INR");
      }
      if (txRes.ok && txData.success) {
        setWalletTransactions(txData.transactions || []);
        if (txData.pagination) setWalletTxPagination(txData.pagination);
      }
    } catch (err) {
      console.error("Fetch wallet data error:", err);
    } finally {
      setWalletLoading(false);
    }
  }, [walletTxPage, walletTxFilter, walletTxDirection, walletSearch]);

  const handleInitiateTopUp = async (e) => {
    e.preventDefault();
    setTopUpError("");

    const numAmount = Number(topUpAmount);
    if (!topUpAmount || isNaN(numAmount) || !isFinite(numAmount)) {
      setTopUpError("Please enter a valid numeric amount.");
      return;
    }

    if (numAmount < 10) {
      setTopUpError("Minimum top-up amount is ₹10.00.");
      return;
    }

    if (numAmount > 100000) {
      setTopUpError("Maximum top-up amount per transaction is ₹1,00,000.00.");
      return;
    }

    if (String(topUpAmount).includes(".") && String(topUpAmount).split(".")[1].length > 2) {
      setTopUpError("Amount can have at most 2 decimal places.");
      return;
    }

    try {
      setTopUpProcessing(true);
      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("http://localhost:5000/api/wallet/topup/create-order", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ amount: numAmount }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setTopUpError(data.message || "Failed to initialize payment gateway.");
        setTopUpProcessing(false);
        return;
      }

      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        setTopUpError("Razorpay SDK failed to load. Please verify your connection.");
        setTopUpProcessing(false);
        return;
      }

      const options = {
        key: data.keyId,
        amount: data.amountInPaise,
        currency: data.currency || "INR",
        name: "FEXA Atelier",
        description: `Wallet Balance Top-up - ₹${numAmount}`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: data.customer?.name || user?.name || "FEXA Patron",
          email: data.customer?.email || user?.email || "",
          contact: data.customer?.phone || user?.phone || "",
        },
        theme: {
          color: "#765493",
        },
        handler: async function (paymentResponse) {
          try {
            setTopUpProcessing(true);
            const verifyRes = await fetch("http://localhost:5000/api/wallet/topup/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
                amount: numAmount,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              setTopUpSuccessModal({
                amount: numAmount,
                balance: verifyData.balance,
                transactionId: verifyData.transaction?.transactionId || `TXN-${Date.now()}`,
              });
              setTopUpAmount("");
              fetchWalletData();
            } else {
              setTopUpError(verifyData.message || "Payment verification failed.");
            }
          } catch (vErr) {
            console.error("Verification error:", vErr);
            setTopUpError("Failed to finalize wallet credit.");
          } finally {
            setTopUpProcessing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setTopUpProcessing(false);
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on("payment.failed", function (failResponse) {
        setTopUpError(failResponse.error?.description || "Payment was cancelled or unsuccessful.");
        setTopUpProcessing(false);
      });
      razorpayInstance.open();
    } catch (err) {
      console.error("Top-up error:", err);
      setTopUpError("Unable to connect to payment server.");
      setTopUpProcessing(false);
    }
  };

  // ========================================
  // CUSTOMER RETURNS STATE & OPERATIONS
  // ========================================
  const [customerReturns, setCustomerReturns] = useState([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsPage, setReturnsPage] = useState(1);
  const [returnsPagination, setReturnsPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [eligibleItems, setEligibleItems] = useState([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [isEligiblePickerOpen, setIsEligiblePickerOpen] = useState(false);

  // Return modal state
  const [returnModalItem, setReturnModalItem] = useState(null);
  const [returnModalOrder, setReturnModalOrder] = useState(null);
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0]);
  const [customerNotes, setCustomerNotes] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnSuccessMsg, setReturnSuccessMsg] = useState("");
  const [returnErrorMsg, setReturnErrorMsg] = useState("");

  // Product Cancellation modal state
  const [cancelModalItem, setCancelModalItem] = useState(null);
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState(CANCELLATION_REASONS[0]);
  const [cancelCustomerNotes, setCancelCustomerNotes] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState("");
  const [cancelErrorMsg, setCancelErrorMsg] = useState("");

  const fetchCustomerReturns = useCallback(async () => {
    try {
      setReturnsLoading(true);
      const token = localStorage.getItem("token");
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`http://localhost:5000/api/returns?page=${returnsPage}&limit=10`, {
        credentials: "include",
        headers,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomerReturns(data.returns || []);
        if (data.pagination) setReturnsPagination(data.pagination);
      }
    } catch (err) {
      console.error("Fetch customer returns error:", err);
    } finally {
      setReturnsLoading(false);
    }
  }, [returnsPage]);

  const fetchEligibleReturnItems = async () => {
    try {
      setEligibleLoading(true);
      const token = localStorage.getItem("token");
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("http://localhost:5000/api/returns/eligible-items", {
        credentials: "include",
        headers,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEligibleItems(data.items || []);
        setIsEligiblePickerOpen(true);
      }
    } catch (err) {
      console.error("Fetch eligible items error:", err);
    } finally {
      setEligibleLoading(false);
    }
  };

  const handleOpenReturnModal = (order, item) => {
    setReturnModalOrder(order);
    setReturnModalItem(item);
    setReturnQuantity(1);
    setReturnReason(RETURN_REASONS[0]);
    setCustomerNotes("");
    setReturnSuccessMsg("");
    setReturnErrorMsg("");
  };

  const handleCloseReturnModal = () => {
    setReturnModalOrder(null);
    setReturnModalItem(null);
    setReturnSuccessMsg("");
    setReturnErrorMsg("");
  };

  const handleOpenCancelModal = (order, item) => {
    setCancelModalOrder(order);
    setCancelModalItem(item);
    setCancelReason(CANCELLATION_REASONS[0]);
    setCancelCustomerNotes("");
    setCancelSuccessMsg("");
    setCancelErrorMsg("");
  };

  const handleCloseCancelModal = () => {
    setCancelModalOrder(null);
    setCancelModalItem(null);
    setCancelSuccessMsg("");
    setCancelErrorMsg("");
  };

  const handleSubmitCancel = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!cancelModalOrder || !cancelModalItem) return;

    try {
      setSubmittingCancel(true);
      setCancelErrorMsg("");
      setCancelSuccessMsg("");

      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const finalReason =
        cancelReason === "Other" && cancelCustomerNotes
          ? `Other: ${cancelCustomerNotes.trim()}`
          : cancelReason;

      const orderId = cancelModalOrder._id || cancelModalOrder.orderId;
      const itemId = cancelModalItem._id || cancelModalItem.itemId;

      const res = await fetch(`http://localhost:5000/api/orders/${orderId}/items/${itemId}/cancel`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ reason: finalReason }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCancelSuccessMsg(data.message || "Fragrance cancelled successfully.");
        if (data.order) {
          setOrders((prevOrders) =>
            prevOrders.map((ord) => (ord._id === data.order._id ? data.order : ord))
          );
        }
        await fetchOrders();
        setTimeout(() => {
          handleCloseCancelModal();
        }, 1500);
      } else {
        setCancelErrorMsg(data.message || "Unable to cancel fragrance item.");
      }
    } catch (err) {
      console.error("Cancel item error:", err);
      setCancelErrorMsg("Failed to connect to cancellation service. Please try again.");
    } finally {
      setSubmittingCancel(false);
    }
  };

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    if (!returnModalOrder || !returnModalItem) return;

    if (returnReason === "Other" && (!customerNotes || customerNotes.trim().length < 5)) {
      setReturnErrorMsg("Please provide a detailed explanation when selecting 'Other'.");
      return;
    }

    try {
      setSubmittingReturn(true);
      setReturnErrorMsg("");
      setReturnSuccessMsg("");

      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("http://localhost:5000/api/returns", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          orderId: returnModalOrder._id || returnModalOrder.orderId,
          itemId: returnModalItem._id || returnModalItem.itemId,
          returnReason,
          customerNotes,
          quantity: returnQuantity,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReturnSuccessMsg(data.message || "Return request submitted successfully.");
        await Promise.all([fetchOrders(), fetchCustomerReturns()]);
        setTimeout(() => {
          handleCloseReturnModal();
          setIsEligiblePickerOpen(false);
        }, 1500);
      } else {
        setReturnErrorMsg(data.message || "Unable to submit return request.");
      }
    } catch (err) {
      console.error("Submit return error:", err);
      setReturnErrorMsg("Failed to connect to return service.");
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Download Invoice PDF
  const handleDownloadInvoice = async (orderId, orderNumber) => {
    try {
      setDownloadingInvoiceId(orderId);
      const token = localStorage.getItem("token");
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`http://localhost:5000/api/orders/${orderId}/invoice`, {
        credentials: "include",
        headers,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to download invoice.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FEXA-Invoice-${orderNumber || "ORD"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Invoice download error:", err);
      alert(err.message || "Could not download invoice. Please try again.");
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchWalletData();
    fetchCustomerReturns();

    // Gentle 15-second polling while viewing wallet or returns tab
    const interval = setInterval(() => {
      if (activeTab === "wallet") {
        fetchWalletData();
      } else if (activeTab === "returns") {
        fetchCustomerReturns();
      }
    }, 15000);

    const handleWindowFocus = () => {
      fetchOrders();
      fetchWalletData();
      fetchCustomerReturns();
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [activeTab, fetchWalletData, fetchCustomerReturns]);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
    if (location.state?.openAddressForm) {
      setShowAddressForm(true);
    }
  }, [location.state]);

  const isGoogleUser = user?.authProvider === "google" || Boolean(user?.googleId);

  // ========================================
  // EDIT PROFILE STATES
  // ========================================

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState(null);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

  useEffect(() => {
    if (!otpExpiresAt) {
      setTimerSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const expiryTime = new Date(otpExpiresAt).getTime();
      const nowTime = new Date().getTime();
      const remaining = Math.max(0, Math.floor((expiryTime - nowTime) / 1000));
      setTimerSeconds(remaining);
      return remaining;
    };

    const remaining = updateRemaining();
    if (remaining <= 0) return;

    const interval = setInterval(() => {
      const rem = updateRemaining();
      if (rem <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [otpExpiresAt]);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // ========================================
  // PROFILE IMAGE STATES
  // ========================================

  const [uploadingImage, setUploadingImage] = useState(false);

  // ========================================
  // ADDRESS STATES
  // ========================================

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressErrors, setAddressErrors] = useState({});
  const [addressTouched, setAddressTouched] = useState({});

  const [addressForm, setAddressForm] = useState({
    label: "Home",
    fullName: "",
    phone: "",
    house: "",
    street: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    isDefault: false,
  });

  // ========================================
  // FETCH PROFILE
  // ========================================

  const fetchProfile = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/profile", {
        method: "GET",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout();
          navigate("/login");
          return;
        }

        setError(data.message || "Unable to load profile.");
        return;
      }

      setUser(data.user);
      setName(data.user.name || "");
      setPhone(data.user.phone || "");

      if (data.user.pendingEmail) {
        setPendingEmail(data.user.pendingEmail);
        if (data.user.emailChangeOtpExpiresAt) {
          setOtpExpiresAt(data.user.emailChangeOtpExpiresAt);
        }
        setIsEditing(true);
      }
    } catch (error) {
      console.error("Profile error:", error);
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // ========================================
  // EDIT PROFILE HANDLERS
  // ========================================

  const handleEdit = () => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setPhone(user?.phone || "");
    setOtp("");
    setPendingEmail(null);
    setSuccessMessage("");
    setError("");
    setNameError("");
    setNameTouched(false);
    setEmailError("");
    setEmailTouched(false);
    setPhoneError("");
    setPhoneTouched(false);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setPhone(user?.phone || "");
    setOtp("");
    setPendingEmail(null);
    setNameError("");
    setNameTouched(false);
    setEmailError("");
    setEmailTouched(false);
    setPhoneError("");
    setPhoneTouched(false);
    setIsEditing(false);
    setError("");
  };

  const handleNameBlur = () => {
    setNameTouched(true);
    setNameError(validateName(name) || "");
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    if (nameTouched) {
      setNameError(validateName(val) || "");
    }
  };

  const handleEmailBlur = () => {
    if (isGoogleUser) return;
    setEmailTouched(true);
    setEmailError(validateEmail(email) || "");
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    if (emailTouched) {
      setEmailError(validateEmail(val) || "");
    }
  };

  const handlePhoneBlur = () => {
    setPhoneTouched(true);
    setPhoneError(validateProfilePhone(phone) || "");
  };

  const handlePhoneChange = (e) => {
    const val = e.target.value;
    setPhone(val);
    if (phoneTouched) {
      setPhoneError(validateProfilePhone(val) || "");
    }
  };

  const handleSave = async () => {
    if (saving) return;

    try {
      setError("");
      setSuccessMessage("");

      // Validate all fields
      setNameTouched(true);
      const nameValError = validateName(name);
      setNameError(nameValError || "");

      let emailValError = null;
      if (!isGoogleUser) {
        setEmailTouched(true);
        emailValError = validateEmail(email);
        setEmailError(emailValError || "");
      }

      setPhoneTouched(true);
      const phoneValError = validateProfilePhone(phone);
      setPhoneError(phoneValError || "");

      // Focus first invalid field
      if (nameValError) {
        document.getElementById("profile-name-input")?.focus();
        return;
      }
      if (emailValError) {
        document.getElementById("profile-email-input")?.focus();
        return;
      }
      if (phoneValError) {
        document.getElementById("profile-phone-input")?.focus();
        return;
      }

      setSaving(true);

      const normalizedName = normalizeName(name);
      const normalizedEmail = isGoogleUser ? user?.email : normalizeEmail(email);
      const normalizedPhone = phone ? phone.trim() : "";

      const response = await fetch("http://localhost:5000/api/profile", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: normalizedName,
          phone: normalizedPhone,
          email: normalizedEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout();
          navigate("/login");
          return;
        }

        if (data.errors) {
          if (data.errors.name) {
            setNameError(data.errors.name);
            setNameTouched(true);
          }
          if (data.errors.email) {
            setEmailError(data.errors.email);
            setEmailTouched(true);
          }
          if (data.errors.phone) {
            setPhoneError(data.errors.phone);
            setPhoneTouched(true);
          }

          if (data.errors.name) {
            document.getElementById("profile-name-input")?.focus();
          } else if (data.errors.email) {
            document.getElementById("profile-email-input")?.focus();
          } else if (data.errors.phone) {
            document.getElementById("profile-phone-input")?.focus();
          }
        }
        setError(data.message || "Unable to update profile.");
        return;
      }

      if (data.emailChangePending) {
        setPendingEmail(data.pendingEmail);
        if (data.emailChangeOtpExpiresAt) {
          setOtpExpiresAt(data.emailChangeOtpExpiresAt);
        }
        setSuccessMessage(data.message || "Verification code sent to your new email address.");
      } else {
        setUser((previousUser) => ({
          ...previousUser,
          ...data.user,
        }));

        if (setAuthUser) {
          setAuthUser((previousUser) => ({
            ...previousUser,
            ...data.user,
          }));
        }

        setIsEditing(false);
        setSuccessMessage("Profile updated successfully.");
      }
    } catch (error) {
      console.error("Update profile error:", error);
      setError("Unable to connect to the server.");
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    try {
      setError("");
      setSuccessMessage("");

      if (!otp || otp.trim().length !== 6) {
        setError("Please enter a valid 6-digit verification code.");
        return;
      }

      setVerifyingOtp(true);

      const response = await fetch("http://localhost:5000/api/profile/verify-email-change", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ otp: otp.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout();
          navigate("/login");
          return;
        }

        setError(data.message || "Unable to verify email code.");
        return;
      }

      setUser((previousUser) => ({
        ...previousUser,
        ...data.user,
      }));

      if (setAuthUser) {
        setAuthUser((previousUser) => ({
          ...previousUser,
          ...data.user,
        }));
      }

      setPendingEmail(null);
      setOtpExpiresAt(null);
      setOtp("");
      setIsEditing(false);
      setSuccessMessage("Email updated successfully.");
    } catch (error) {
      console.error("Verify email error:", error);
      setError("Unable to connect to the server.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (timerSeconds > 0) return;

    try {
      setError("");
      setSuccessMessage("");
      setResendingOtp(true);

      const response = await fetch("http://localhost:5000/api/profile/resend-email-change-otp", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to resend verification code.");
        return;
      }

      if (data.emailChangeOtpExpiresAt) {
        setOtpExpiresAt(data.emailChangeOtpExpiresAt);
      }
      setSuccessMessage(data.message || "New verification code sent.");
    } catch (error) {
      console.error("Resend OTP error:", error);
      setError("Unable to connect to the server.");
    } finally {
      setResendingOtp(false);
    }
  };

  // ========================================
  // PROFILE IMAGE UPLOAD
  // ========================================

  const handleImageChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Only JPG, JPEG, PNG and WEBP images are allowed.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB.");
      event.target.value = "";
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      setUploadingImage(true);

      const formData = new FormData();
      formData.append("profileImage", file);

      const response = await fetch("http://localhost:5000/api/profile/upload-image", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout();
          navigate("/login");
          return;
        }

        setError(data.message || "Unable to upload profile image.");
        return;
      }

      const updatedImage = data.profileImage || (data.user && data.user.profileImage);

      setUser((previousUser) => ({
        ...previousUser,
        profileImage: updatedImage,
      }));

      if (setAuthUser) {
        setAuthUser((previousUser) =>
          previousUser ? { ...previousUser, profileImage: updatedImage } : previousUser
        );
      }

      setSuccessMessage("Profile picture updated successfully.");
    } catch (error) {
      console.error("Profile image upload error:", error);
      setError("Unable to connect to the server.");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  // ========================================
  // ADDRESS HANDLERS
  // ========================================

  const handleAddressChange = (event) => {
    const { name, value, type, checked } = event.target;
    const newValue = type === "checkbox" ? checked : value;

    setAddressForm((previous) => {
      const updated = {
        ...previous,
        [name]: newValue,
      };

      // Real-time validation for already-touched fields
      if (addressTouched[name]) {
        const fieldError = validateAddressField(name, newValue, updated);
        setAddressErrors((prevErrors) => {
          const next = { ...prevErrors };
          if (fieldError) {
            next[name] = fieldError;
          } else {
            delete next[name];
          }
          return next;
        });
      }

      // If country changed, re-validate phone and pincode if touched
      if (name === "country") {
        if (addressTouched.phone) {
          const phoneErr = validateAddressField("phone", updated.phone, updated);
          setAddressErrors((prev) => {
            const next = { ...prev };
            if (phoneErr) next.phone = phoneErr;
            else delete next.phone;
            return next;
          });
        }
        if (addressTouched.pincode) {
          const pinErr = validateAddressField("pincode", updated.pincode, updated);
          setAddressErrors((prev) => {
            const next = { ...prev };
            if (pinErr) next.pincode = pinErr;
            else delete next.pincode;
            return next;
          });
        }
      }

      return updated;
    });
  };

  const handleAddressBlur = (event) => {
    const { name, value } = event.target;
    setAddressTouched((prev) => ({ ...prev, [name]: true }));
    const fieldError = validateAddressField(name, value, addressForm);
    setAddressErrors((prev) => {
      const next = { ...prev };
      if (fieldError) {
        next[name] = fieldError;
      } else {
        delete next[name];
      }
      return next;
    });
  };

  const openAddressForm = (address = null) => {
    setError("");
    setSuccessMessage("");
    setAddressErrors({});
    setAddressTouched({});

    if (address && address._id) {
      setEditingAddressId(address._id);
      setAddressForm({
        label: address.label || "Home",
        fullName: address.fullName || "",
        phone: address.phone || "",
        house: address.house || "",
        street: address.street || "",
        city: address.city || "",
        state: address.state || "",
        pincode: address.pincode || "",
        country: address.country || "India",
        isDefault: Boolean(address.isDefault),
      });
    } else {
      setEditingAddressId(null);
      setAddressForm({
        label: "Home",
        fullName: user?.name || "",
        phone: user?.phone || "",
        house: "",
        street: "",
        city: "",
        state: "",
        pincode: "",
        country: "India",
        isDefault: !user?.addresses || user.addresses.length === 0,
      });
    }
    setShowAddressForm(true);
    setActiveTab("addresses");
  };

  const closeAddressForm = () => {
    setShowAddressForm(false);
    setEditingAddressId(null);
    setAddressErrors({});
    setAddressTouched({});
    setAddressForm({
      label: "Home",
      fullName: "",
      phone: "",
      house: "",
      street: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
      isDefault: false,
    });
  };

  const handleSaveAddress = async (event) => {
    event.preventDefault();
    try {
      setError("");
      setSuccessMessage("");

      // Mark all fields as touched
      const allFields = ["label", "fullName", "phone", "house", "street", "city", "state", "pincode", "country"];
      const touchedAll = {};
      allFields.forEach((f) => { touchedAll[f] = true; });
      setAddressTouched(touchedAll);

      // Run full form validation
      const { isValid, errors } = validateAddressForm(addressForm);
      if (!isValid) {
        setAddressErrors(errors);
        // Focus first invalid input field
        const firstInvalid = allFields.find((f) => errors[f]);
        if (firstInvalid) {
          const el = document.querySelector(`[name="${firstInvalid}"]`);
          if (el) el.focus();
        }
        return;
      }

      setSavingAddress(true);

      const endpoint = editingAddressId
        ? `http://localhost:5000/api/profile/addresses/${editingAddressId}`
        : "http://localhost:5000/api/profile/addresses";
      const method = editingAddressId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(addressForm),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout();
          navigate("/login");
          return;
        }

        if (data.errors) {
          setAddressErrors(data.errors);
        }
        setError(data.message || (editingAddressId ? "Unable to update address." : "Unable to add address."));
        return;
      }

      setUser((previousUser) => ({
        ...previousUser,
        addresses: data.addresses,
      }));

      closeAddressForm();
      setSuccessMessage(editingAddressId ? "Address updated successfully." : "Address added successfully.");
    } catch (error) {
      console.error("Save address error:", error);
      setError("Unable to connect to the server.");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm("Are you sure you want to delete this delivery address?")) {
      return;
    }
    try {
      setError("");
      setSuccessMessage("");
      const response = await fetch(`http://localhost:5000/api/profile/addresses/${addressId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout();
          navigate("/login");
          return;
        }
        setError(data.message || "Unable to delete address.");
        return;
      }

      setUser((previousUser) => ({
        ...previousUser,
        addresses: data.addresses,
      }));

      if (editingAddressId === addressId) {
        closeAddressForm();
      }
      setSuccessMessage("Address deleted successfully.");
    } catch (error) {
      console.error("Delete address error:", error);
      setError("Unable to connect to the server.");
    }
  };

  // ========================================
  // LOGOUT
  // ========================================

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  // ========================================
  // RENDER STATES
  // ========================================

  if (loading) {
    return (
      <main className="profile-page">
        <div className="profile-loading">Loading profile...</div>
      </main>
    );
  }

  if (error && !user) {
    return (
      <main className="profile-page">
        <div className="profile-error">
          <h2>Something went wrong</h2>
          <p>{error}</p>
          <button onClick={() => navigate("/home")}>Back to Home</button>
        </div>
      </main>
    );
  }

  return (
    <main className="profile-page">
      {/* NAVBAR */}
      <Navbar
        activePage="profile"
        onMobileMenuToggle={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* PAGE HEADER */}
      <section className="profile-header-banner">
        <div className="header-banner-container">
          <span className="banner-sublabel">PATRON PRIVÉ PORTAL • ATELIER № 842</span>
          <h1>My Account</h1>
          <p>Manage your personal profile, orders, addresses, and atelier security.</p>
        </div>
      </section>

      {/* MAIN TWO-COLUMN CONTAINER */}
      <section className="profile-content-container">
        {/* LEFT COLUMN: USER SIDEBAR */}
        <div className="profile-sidebar-column">
          <UserSidebar
            user={user}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onLogout={handleLogout}
            isMobileOpen={isMobileSidebarOpen}
            setIsMobileOpen={setIsMobileSidebarOpen}
            ordersCount={orders.length}
          />
        </div>

        {/* RIGHT COLUMN: MAIN CONTENT AREA */}
        <div className="profile-main-column">
          {/* SUCCESS MESSAGE */}
          {successMessage && <div className="profile-success">{successMessage}</div>}

          {/* ERROR MESSAGE */}
          {error && <div className="profile-form-error">{error}</div>}

          {/* 4 LUXURY STAT CARDS (REFERENCE 1 MATCH) */}
          <div className="account-stats-grid">
            <div
              className={`account-stat-card ${activeTab === "orders" ? "active" : ""}`}
              onClick={() => setActiveTab("orders")}
            >
              <div className="stat-card-header">
                <span className="stat-card-label">ORDERS PLACED</span>
                <div className="stat-icon-wrapper">📦</div>
              </div>
              <div className="stat-card-value">{ordersLoading ? "..." : orders.length}</div>
              <div className="stat-card-subtext">Lifetime purchases</div>
              <span className="stat-card-link">View All Orders →</span>
            </div>

            <div
              className={`account-stat-card ${activeTab === "wishlist" ? "active" : ""}`}
              onClick={() => openWishlist()}
            >
              <div className="stat-card-header">
                <span className="stat-card-label">WISHLIST ITEMS</span>
                <div className="stat-icon-wrapper">♡</div>
              </div>
              <div className="stat-card-value">{wishlistCount}</div>
              <div className="stat-card-subtext">Curated flacons</div>
              <span className="stat-card-link">View Wishlist →</span>
            </div>

            <div
              className={`account-stat-card ${activeTab === "addresses" ? "active" : ""}`}
              onClick={() => setActiveTab("addresses")}
            >
              <div className="stat-card-header">
                <span className="stat-card-label">SAVED ADDRESSES</span>
                <div className="stat-icon-wrapper">📍</div>
              </div>
              <div className="stat-card-value">{user?.addresses?.length || 2}</div>
              <div className="stat-card-subtext">Deliveries & Atelier gifts</div>
              <span className="stat-card-link">Manage Addresses →</span>
            </div>

            <div
              className={`account-stat-card ${activeTab === "wallet" ? "active" : ""}`}
              onClick={() => setActiveTab("wallet")}
            >
              <div className="stat-card-header">
                <span className="stat-card-label">FEXA WALLET</span>
                <div className="stat-icon-wrapper">👛</div>
              </div>
              <div className="stat-card-value">{formatPrice(walletBalance)}</div>
              <div className="stat-card-subtext">Verified Atelier Balance</div>
              <span className="stat-card-link">View Wallet →</span>
            </div>
          </div>

          {/* DYNAMIC TAB SECTION CONTENT */}
          {activeTab === "profile" && (
            <section className="profile-card">
              {/* PROFILE PHOTO */}
              <div className="profile-photo-section">
                <div className="profile-photo">
                  {user?.profileImage ? (
                    <img src={getProfileImageUrl(user?.profileImage)} alt="Profile" />
                  ) : (
                    <span>{user?.name?.charAt(0)?.toUpperCase() || "F"}</span>
                  )}
                </div>

                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  id="profile-image-input"
                  style={{ display: "none" }}
                  onChange={handleImageChange}
                />

                <label htmlFor="profile-image-input" className="photo-button">
                  {uploadingImage
                    ? "UPLOADING..."
                    : user?.profileImage
                    ? "CHANGE PHOTO"
                    : "ADD PHOTO"}
                </label>
              </div>

              {/* PERSONAL DETAILS */}
              <div className="profile-details">
                <div className="profile-details-header">
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>PERSONAL DETAILS</span>
                      {isGoogleUser && (
                        <span className="google-user-badge">GOOGLE USER</span>
                      )}
                    </div>
                    <h2>{user?.name || "User"}</h2>
                  </div>

                  {!isEditing && (
                    <button className="edit-profile-button" onClick={handleEdit}>
                      EDIT PROFILE
                    </button>
                  )}
                </div>

                {/* EDIT MODE */}
                {isEditing ? (
                  <div className="profile-edit-form">
                    <div className="profile-input-group">
                      <label htmlFor="profile-name-input">FULL NAME</label>
                      <input
                        id="profile-name-input"
                        type="text"
                        value={name}
                        onChange={handleNameChange}
                        onBlur={handleNameBlur}
                        className={nameTouched && nameError ? "input-error" : ""}
                        placeholder="Enter your name"
                        disabled={saving}
                      />
                      {nameTouched && nameError && (
                        <span className="profile-field-error">{nameError}</span>
                      )}
                    </div>

                    <div className="profile-input-group">
                      <label>EMAIL ADDRESS</label>
                      {isGoogleUser ? (
                        <>
                          <input type="email" value={user?.email || ""} disabled />
                          <small>
                            Email cannot be changed for accounts authenticated with Google.
                          </small>
                        </>
                      ) : (
                        <>
                          <input
                            id="profile-email-input"
                            type="email"
                            value={email}
                            onChange={handleEmailChange}
                            onBlur={handleEmailBlur}
                            className={emailTouched && emailError ? "input-error" : ""}
                            placeholder="Enter your email"
                            disabled={saving || Boolean(pendingEmail)}
                          />
                          {emailTouched && emailError && (
                            <span className="profile-field-error">{emailError}</span>
                          )}
                          <small>
                            {pendingEmail
                              ? `Verification code sent to ${pendingEmail}`
                              : "Changing email requires verification code sent to new email."}
                          </small>
                        </>
                      )}
                    </div>

                    {!isGoogleUser && pendingEmail && (
                      <div className="profile-input-group">
                        <label>VERIFICATION CODE (SENT TO {pendingEmail})</label>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="Enter 6-digit OTP"
                            maxLength={6}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            className="photo-button"
                            onClick={handleVerifyEmailOtp}
                            disabled={verifyingOtp || !otp}
                            style={{ margin: 0 }}
                          >
                            {verifyingOtp ? "VERIFYING..." : "VERIFY OTP"}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleResendEmailOtp}
                          disabled={timerSeconds > 0 || resendingOtp}
                          style={{
                            background: "none",
                            border: "none",
                            color: timerSeconds > 0 ? "#817789" : "#a184bd",
                            cursor: timerSeconds > 0 ? "not-allowed" : "pointer",
                            fontSize: "12px",
                            marginTop: "6px",
                            textDecoration: timerSeconds > 0 ? "none" : "underline",
                          }}
                        >
                          {resendingOtp
                            ? "RESENDING..."
                            : timerSeconds > 0
                            ? `Resend Code in ${formatTimer(timerSeconds)}`
                            : "Resend Code"}
                        </button>
                      </div>
                    )}

                    <div className="profile-input-group">
                      <label>PHONE NUMBER</label>
                      <input
                        id="profile-phone-input"
                        type="tel"
                        value={phone}
                        onChange={handlePhoneChange}
                        onBlur={handlePhoneBlur}
                        className={phoneTouched && phoneError ? "input-error" : ""}
                        placeholder="Enter your phone number"
                        disabled={saving}
                      />
                      {phoneTouched && phoneError && (
                        <span className="profile-field-error">{phoneError}</span>
                      )}
                    </div>

                    <div className="profile-edit-actions">
                      <button
                        className="cancel-profile-button"
                        onClick={handleCancel}
                        disabled={saving}
                      >
                        CANCEL
                      </button>
                      <button
                        className="save-profile-button"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? "SAVING..." : "SAVE CHANGES"}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* NORMAL VIEW */
                  <>
                    <div className="profile-info">
                      <span>FULL NAME</span>
                      <p>{user?.name || "Not added"}</p>
                    </div>

                    <div className="profile-info">
                      <span>EMAIL ADDRESS</span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <p style={{ margin: 0 }}>{user?.email || "Not available"}</p>
                        {isGoogleUser && (
                          <span className="google-email-tag">Google Account</span>
                        )}
                      </div>
                    </div>

                    <div className="profile-info">
                      <span>PHONE NUMBER</span>
                      <p>{user?.phone || "Not added"}</p>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* ADDRESSES TAB OR ADDRESSES SECTION */}
          {(activeTab === "addresses" || activeTab === "profile") && (
            <section className="addresses-section">
              <div className="addresses-header">
                <div>
                  <span>DELIVERY</span>
                  <h2>My Addresses</h2>
                </div>
                <button className="add-address-button" onClick={openAddressForm}>
                  + ADD ADDRESS
                </button>
              </div>

              {/* ADDRESS FORM */}
              {showAddressForm && (
                <div className="address-form-wrapper">
                  <div className="address-form-header">
                    <div>
                      <span>{editingAddressId ? "EDIT ADDRESS" : "NEW ADDRESS"}</span>
                      <h3>{editingAddressId ? "Edit Delivery Address" : "Add Delivery Address"}</h3>
                    </div>
                    <button
                      type="button"
                      className="close-address-button"
                      onClick={closeAddressForm}
                    >
                      ×
                    </button>
                  </div>

                  <form className="address-form" onSubmit={handleSaveAddress} noValidate>
                    <div className="address-field">
                      <label>ADDRESS TYPE</label>
                      <select
                        name="label"
                        value={addressForm.label}
                        onChange={handleAddressChange}
                        onBlur={handleAddressBlur}
                        className={addressTouched.label && addressErrors.label ? "input-error" : ""}
                      >
                        <option value="Home">Home</option>
                        <option value="Work">Work</option>
                        <option value="Other">Other</option>
                      </select>
                      {addressTouched.label && addressErrors.label && (
                        <span className="address-field-error">{addressErrors.label}</span>
                      )}
                    </div>

                    <div className="address-field">
                      <label>FULL NAME</label>
                      <input
                        type="text"
                        name="fullName"
                        value={addressForm.fullName}
                        onChange={handleAddressChange}
                        onBlur={handleAddressBlur}
                        placeholder="Enter full name"
                        className={addressTouched.fullName && addressErrors.fullName ? "input-error" : ""}
                      />
                      {addressTouched.fullName && addressErrors.fullName && (
                        <span className="address-field-error">{addressErrors.fullName}</span>
                      )}
                    </div>

                    <div className="address-field">
                      <label>PHONE NUMBER</label>
                      <input
                        type="tel"
                        name="phone"
                        value={addressForm.phone}
                        onChange={handleAddressChange}
                        onBlur={handleAddressBlur}
                        placeholder="Enter phone number"
                        className={addressTouched.phone && addressErrors.phone ? "input-error" : ""}
                      />
                      {addressTouched.phone && addressErrors.phone && (
                        <span className="address-field-error">{addressErrors.phone}</span>
                      )}
                    </div>

                    <div className="address-field">
                      <label>HOUSE / BUILDING</label>
                      <input
                        type="text"
                        name="house"
                        value={addressForm.house}
                        onChange={handleAddressChange}
                        onBlur={handleAddressBlur}
                        placeholder="House / Building name"
                        className={addressTouched.house && addressErrors.house ? "input-error" : ""}
                      />
                      {addressTouched.house && addressErrors.house && (
                        <span className="address-field-error">{addressErrors.house}</span>
                      )}
                    </div>

                    <div className="address-field">
                      <label>STREET</label>
                      <input
                        type="text"
                        name="street"
                        value={addressForm.street}
                        onChange={handleAddressChange}
                        onBlur={handleAddressBlur}
                        placeholder="Street / Area"
                        className={addressTouched.street && addressErrors.street ? "input-error" : ""}
                      />
                      {addressTouched.street && addressErrors.street && (
                        <span className="address-field-error">{addressErrors.street}</span>
                      )}
                    </div>

                    <div className="address-field">
                      <label>CITY</label>
                      <input
                        type="text"
                        name="city"
                        value={addressForm.city}
                        onChange={handleAddressChange}
                        onBlur={handleAddressBlur}
                        placeholder="City"
                        className={addressTouched.city && addressErrors.city ? "input-error" : ""}
                      />
                      {addressTouched.city && addressErrors.city && (
                        <span className="address-field-error">{addressErrors.city}</span>
                      )}
                    </div>

                    <div className="address-field">
                      <label>STATE</label>
                      <input
                        type="text"
                        name="state"
                        value={addressForm.state}
                        onChange={handleAddressChange}
                        onBlur={handleAddressBlur}
                        placeholder="State"
                        className={addressTouched.state && addressErrors.state ? "input-error" : ""}
                      />
                      {addressTouched.state && addressErrors.state && (
                        <span className="address-field-error">{addressErrors.state}</span>
                      )}
                    </div>

                    <div className="address-field">
                      <label>PINCODE</label>
                      <input
                        type="text"
                        name="pincode"
                        value={addressForm.pincode}
                        onChange={handleAddressChange}
                        onBlur={handleAddressBlur}
                        placeholder="Pincode"
                        className={addressTouched.pincode && addressErrors.pincode ? "input-error" : ""}
                      />
                      {addressTouched.pincode && addressErrors.pincode && (
                        <span className="address-field-error">{addressErrors.pincode}</span>
                      )}
                    </div>

                    <div className="address-field">
                      <label>COUNTRY</label>
                      <input
                        type="text"
                        name="country"
                        value={addressForm.country}
                        onChange={handleAddressChange}
                        onBlur={handleAddressBlur}
                        className={addressTouched.country && addressErrors.country ? "input-error" : ""}
                      />
                      {addressTouched.country && addressErrors.country && (
                        <span className="address-field-error">{addressErrors.country}</span>
                      )}
                    </div>

                    <label className="default-address">
                      <input
                        type="checkbox"
                        name="isDefault"
                        checked={addressForm.isDefault}
                        onChange={handleAddressChange}
                      />
                      <span>Make this my default address</span>
                    </label>

                    <div className="address-form-actions">
                      <button
                        type="button"
                        className="cancel-address-button"
                        onClick={closeAddressForm}
                        disabled={savingAddress}
                      >
                        CANCEL
                      </button>
                      <button
                        type="submit"
                        className="save-address-button"
                        disabled={savingAddress}
                      >
                        {savingAddress
                          ? "SAVING..."
                          : editingAddressId
                          ? "UPDATE ADDRESS"
                          : "SAVE ADDRESS"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* NO ADDRESS */}
              {(!user?.addresses || user.addresses.length === 0) && !showAddressForm && (
                <div className="no-address">
                  <div>+</div>
                  <h3>No addresses added</h3>
                  <p>Add an address for a faster checkout experience.</p>
                  <button className="add-address-empty" onClick={() => openAddressForm()}>
                    ADD YOUR FIRST ADDRESS
                  </button>
                </div>
              )}

              {/* ADDRESS CARDS */}
              {user?.addresses?.length > 0 && (
                <div className="address-grid">
                  {user.addresses.map((address, index) => (
                    <div className="address-card" key={address._id || index}>
                      <div className="address-card-top">
                        <span>{address.label || "ADDRESS"}</span>
                        {address.isDefault && <small>DEFAULT</small>}
                      </div>
                      <h3>{address.fullName}</h3>
                      <p>
                        {address.house}
                        <br />
                        {address.street}
                        <br />
                        {address.city}, {address.state}
                        <br />
                        {address.pincode}
                        <br />
                        {address.country}
                      </p>
                      <div className="address-actions">
                        <button type="button" onClick={() => openAddressForm(address)}>EDIT</button>
                        <button type="button" onClick={() => handleDeleteAddress(address._id)}>DELETE</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ORDERS TAB */}
          {activeTab === "orders" && (
            <section className="orders-section">
              <div className="orders-section-header">
                <div>
                  <span className="orders-eyebrow">ATELIER DISPATCH & MANIFESTS</span>
                  <h2>My Orders</h2>
                  <p className="orders-subheading">
                    Track your bespoke fragrances, delivery milestones, and vault acquisition history.
                  </p>
                </div>
                {orders.length > 0 && (
                  <button
                    type="button"
                    className="orders-refresh-button"
                    onClick={fetchOrders}
                    disabled={ordersLoading}
                    title="Refresh orders"
                  >
                    {ordersLoading ? "Refreshing..." : "↻ Refresh"}
                  </button>
                )}
              </div>

              {/* LOADING STATE */}
              {ordersLoading && (
                <div className="orders-loading-state">
                  <div className="orders-loading-spinner" />
                  <p>Accessing your atelier records...</p>
                </div>
              )}

              {/* ERROR STATE */}
              {!ordersLoading && ordersError && (
                <div className="orders-error-banner">
                  <span>⚠️ {ordersError}</span>
                  <button type="button" onClick={fetchOrders} className="orders-retry-button">
                    Try Again
                  </button>
                </div>
              )}

              {/* EMPTY STATE */}
              {!ordersLoading && !ordersError && orders.length === 0 && (
                <div className="orders-empty-card">
                  <div className="orders-empty-seal">⚜️</div>
                  <h3>No Orders In Your Vault Yet</h3>
                  <p>
                    Your personal fragrance archive awaits its inaugural acquisition. Explore our curated
                    extraits, eau de parfums, and bespoke size flacons.
                  </p>
                  <button
                    type="button"
                    className="orders-explore-btn"
                    onClick={() => navigate("/collections")}
                  >
                    DISCOVER THE ATELIER COLLECTIONS →
                  </button>
                </div>
              )}

              {/* ORDERS LIST */}
              {!ordersLoading && !ordersError && orders.length > 0 && (
                <div className="orders-list">
                  {orders.map((order) => {
                    let statusClass = "status-processing";
                    let statusIcon = "●";
                    let currentStep = 1;

                    switch (order.orderStatus) {
                      case "Pending":
                        statusClass = "status-pending";
                        statusIcon = "⏳";
                        currentStep = 0;
                        break;
                      case "Confirmed":
                        statusClass = "status-confirmed";
                        statusIcon = "✓";
                        currentStep = 1;
                        break;
                      case "Processing":
                        statusClass = "status-processing";
                        statusIcon = "⚙";
                        currentStep = 1;
                        break;
                      case "Dispatched":
                      case "Shipped":
                        statusClass = "status-shipped";
                        statusIcon = "✈";
                        currentStep = 2;
                        break;
                      case "Out for Delivery":
                        statusClass = "status-out-for-delivery";
                        statusIcon = "🚚";
                        currentStep = 2.5;
                        break;
                      case "Delivered":
                        statusClass = "status-delivered";
                        statusIcon = "✓";
                        currentStep = 3;
                        break;
                      case "Cancelled":
                        statusClass = "status-cancelled";
                        statusIcon = "✕";
                        currentStep = -1;
                        break;
                      case "Return Requested":
                        statusClass = "status-return-requested";
                        statusIcon = "⏳";
                        currentStep = 4;
                        break;
                      case "Return Approved":
                        statusClass = "status-return-approved";
                        statusIcon = "✓";
                        currentStep = 4;
                        break;
                      case "Return Rejected":
                        statusClass = "status-return-rejected";
                        statusIcon = "✕";
                        currentStep = 4;
                        break;
                      case "Returned":
                      case "Refunded":
                        statusClass = "status-returned";
                        statusIcon = "↩";
                        currentStep = 4;
                        break;
                      default:
                        statusClass = "status-processing";
                        statusIcon = "●";
                        currentStep = 1;
                    }

                    const formattedDate = order.createdAt
                      ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Recently Placed";

                    return (
                      <article key={order._id || order.orderNumber} className="order-luxury-card">
                        {/* ORDER CARD HEADER */}
                        <div className="order-card-header">
                          <div className="order-header-meta">
                            <span className="order-label-tag">MANIFEST NUMBER</span>
                            <div className="order-number-row">
                              <h3 className="order-number-text">{order.orderNumber}</h3>
                              <span className="order-date-text">• {formattedDate}</span>
                            </div>
                          </div>

                          <div className="order-header-badge-group">
                            <span className={`order-status-badge ${statusClass}`}>
                              <span className="status-dot">{statusIcon}</span>
                              {order.orderStatus || "Processing"}
                            </span>
                            <div className="order-amount-pill">
                              {formatPrice(order.totalAmount)}
                            </div>
                            <button
                              type="button"
                              className="order-download-invoice-btn"
                              onClick={() => handleDownloadInvoice(order._id, order.orderNumber)}
                              disabled={downloadingInvoiceId === order._id}
                              title="Download Official Tax Invoice as PDF"
                            >
                              <span>{downloadingInvoiceId === order._id ? "⌛" : "📄"}</span>
                              <span>{downloadingInvoiceId === order._id ? "Generating..." : "Download Invoice"}</span>
                            </button>
                          </div>
                        </div>

                        {/* SHIPMENT TRACKING STRIP (When tracking information is stored) */}
                        {order.trackingInfo?.trackingNumber && (
                          <div className="order-carrier-strip">
                            <span className="carrier-icon">🚚</span>
                            <span className="carrier-name">
                              {order.trackingInfo.courierProvider || "Express Delivery"}:
                            </span>
                            <strong className="tracking-code">
                              {order.trackingInfo.trackingNumber}
                            </strong>
                            {order.trackingInfo.trackingUrl && (
                              <a
                                href={order.trackingInfo.trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="track-live-link"
                              >
                                Track Package ↗
                              </a>
                            )}
                          </div>
                        )}

                        {/* LIVE TRACKING PROGRESS BAR */}
                        {order.orderStatus === "Cancelled" ? (
                          <div className="order-cancelled-notice">
                            <span>✕ This order has been cancelled and vault reservation released.</span>
                          </div>
                        ) : order.orderStatus === "Return Requested" ? (
                          <div className="order-carrier-strip" style={{ background: "#f5f3ff", borderColor: "#ddd6fe", color: "#5b21b6" }}>
                            <span>⏳ Return request submitted. Our atelier team is reviewing your inspection request.</span>
                          </div>
                        ) : order.orderStatus === "Return Approved" ? (
                          <div className="order-carrier-strip" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46" }}>
                            <span>✓ Return approved. Complimentary courier collection initiated.</span>
                          </div>
                        ) : order.orderStatus === "Returned" || order.orderStatus === "Refunded" ? (
                          <div className="order-carrier-strip" style={{ background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>
                            <span>✓ Flacon returned & refund processed to your original payment ledger.</span>
                          </div>
                        ) : (
                          <div className="order-tracker-container">
                            <div className="order-tracker-bar">
                              <div
                                className="order-tracker-progress"
                                style={{
                                  width:
                                    currentStep === 3
                                      ? "100%"
                                      : currentStep === 2.5
                                      ? "85%"
                                      : currentStep === 2
                                      ? "66%"
                                      : currentStep === 1
                                      ? "33%"
                                      : "10%",
                                }}
                              />
                            </div>
                            <div className="order-tracker-steps">
                              <div className={`tracker-step ${currentStep >= 0 ? "completed" : ""}`}>
                                <div className="step-circle">✓</div>
                                <span className="step-label">Order Placed</span>
                              </div>
                              <div
                                className={`tracker-step ${
                                  currentStep >= 1 ? "completed" : ""
                                } ${currentStep === 1 ? "active" : ""}`}
                              >
                                <div className="step-circle">{currentStep >= 2 ? "✓" : "2"}</div>
                                <span className="step-label">Atelier Preparing</span>
                              </div>
                              <div
                                className={`tracker-step ${
                                  currentStep >= 2 ? "completed" : ""
                                } ${currentStep === 2 ? "active" : ""}`}
                              >
                                <div className="step-circle">{currentStep >= 3 ? "✓" : "3"}</div>
                                <span className="step-label">Dispatched</span>
                              </div>
                              <div
                                className={`tracker-step ${
                                  currentStep >= 3 ? "completed active" : ""
                                }`}
                              >
                                <div className="step-circle">4</div>
                                <span className="step-label">Delivered</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ITEMS LIST */}
                        <div className="order-items-container">
                          {order.items &&
                            order.items.map((it, idx) => (
                              <div key={it._id || idx} className="order-item-card">
                                <div className="order-item-thumb-wrapper">
                                  {it.image ? (
                                    <img
                                      src={getImageUrl(it.image)}
                                      alt={it.name}
                                      className="order-item-thumb"
                                      onError={(e) => {
                                        e.target.style.display = "none";
                                        if (e.target.nextSibling) {
                                          e.target.nextSibling.style.display = "flex";
                                        }
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className="order-item-fallback-icon"
                                    style={{ display: it.image ? "none" : "flex" }}
                                  >
                                    🧴
                                  </div>
                                </div>

                                <div className="order-item-details">
                                  <div className="order-item-heading-row">
                                    <h4
                                      className="order-item-name"
                                      onClick={() => it.product && navigate(`/products/${it.product}`)}
                                      style={{ cursor: it.product ? "pointer" : "default" }}
                                      title={it.product ? "View perfume details" : ""}
                                    >
                                      {it.name}
                                    </h4>
                                    <div className="order-item-price-block">
                                      {it.allocatedCouponDiscount > 0 ? (
                                        <>
                                          <span className="item-original-price">
                                            {formatPrice(it.originalLineAmount || (it.unitPrice * it.quantity))}
                                          </span>
                                          <span className="item-discount-pill">
                                            -{formatPrice(it.allocatedCouponDiscount)}
                                          </span>
                                          <span className="item-net-price">
                                            {formatPrice(it.discountedLineAmount || (it.lineTotal - it.allocatedCouponDiscount))}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="order-item-line-total">
                                          {formatPrice(it.lineTotal || (it.unitPrice * it.quantity))}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="order-item-tags-row">
                                    <span className="order-item-brand-tag">
                                      {it.brand || "FEXA"}
                                    </span>
                                    {it.category && (
                                      <span className="order-item-category-tag">
                                        {it.category}
                                      </span>
                                    )}
                                    {it.volumeMl && (
                                      <span className="order-item-size-badge">
                                        💧 {it.volumeMl} ml Flacon
                                      </span>
                                    )}
                                  </div>

                                  <div className="order-item-pricing-meta">
                                    <span>
                                      Quantity: <strong>{it.quantity}</strong>
                                    </span>
                                    <span className="pricing-separator">•</span>
                                    <span>
                                      Unit Price: <strong>{formatPrice(it.unitPrice)}</strong>
                                    </span>
                                    {it.allocatedCouponDiscount > 0 && (
                                      <>
                                        <span className="pricing-separator">•</span>
                                        <span className="item-per-unit-note">
                                          Net: <strong>{formatPrice(it.discountedUnitAmount || (it.unitPrice - (it.allocatedCouponDiscount / it.quantity)))}</strong> / unit
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  {/* Item Status, Cancellation & Return Actions */}
                                  <div className="order-item-return-section">
                                    {/* Cancelled badge */}
                                    {it.itemStatus === "Cancelled" && (
                                      <span className="order-item-cancelled-badge">
                                        ✕ Cancelled
                                        {it.refundStatus === "Refunded" && (
                                          <span className="cancelled-refund-tag">
                                            {" "}• Refunded: {formatPrice(it.refundAmount || it.discountedLineAmount || (it.lineTotal - (it.allocatedCouponDiscount || 0)))}
                                          </span>
                                        )}
                                        {it.refundStatus === "Pending" && (
                                          <span className="cancelled-refund-tag">
                                            {" "}• Refund Pending
                                          </span>
                                        )}
                                      </span>
                                    )}

                                    {/* Returned badge */}
                                    {it.returnedQuantity > 0 && (
                                      <span className="order-item-refunded-badge">
                                        ✓ Returned: {it.returnedQuantity} of {it.quantity} unit(s) • Refunded: {formatPrice(it.refundAmount || 0)}
                                      </span>
                                    )}
                                    {it.itemStatus === "Return Requested" && (
                                      <span className="order-item-return-badge">
                                        ⏳ Return Requested ({it.requestedReturnQuantity || (it.quantity - (it.returnedQuantity || 0))} unit(s)) • Pending Verification
                                      </span>
                                    )}
                                    {it.itemStatus === "Return Rejected" && (
                                      <span className="order-item-return-badge" style={{ background: "rgba(239, 68, 68, 0.15)", borderColor: "rgba(239, 68, 68, 0.3)", color: "#ef4444" }}>
                                        ✕ Return Rejected
                                      </span>
                                    )}

                                    {/* Active status pill */}
                                    {it.itemStatus !== "Cancelled" &&
                                      it.itemStatus !== "Returned" &&
                                      it.itemStatus !== "Return Requested" &&
                                      it.itemStatus !== "Return Rejected" &&
                                      (it.returnedQuantity || 0) === 0 && (
                                        <span className="order-item-live-status">
                                          ● {it.itemStatus || order.orderStatus || "Processing"}
                                        </span>
                                      )}

                                    {/* Cancel Product Button (Only when eligible) */}
                                    {["Processing", "Confirmed", "Pending", "Placed"].includes(order.orderStatus) &&
                                      it.itemStatus !== "Cancelled" &&
                                      it.itemStatus !== "Returned" &&
                                      it.itemStatus !== "Return Requested" && (
                                        <button
                                          type="button"
                                          className="order-item-cancel-btn"
                                          onClick={() => handleOpenCancelModal(order, it)}
                                          title="Cancel this fragrance item from order"
                                        >
                                          ✕ Cancel Product
                                        </button>
                                      )}

                                    {/* Request Return Button (Delivered orders only) */}
                                    {order.orderStatus === "Delivered" &&
                                      it.itemStatus !== "Cancelled" &&
                                      (it.quantity - (it.returnedQuantity || 0)) > 0 &&
                                      it.itemStatus !== "Return Requested" && (
                                        <button
                                          type="button"
                                          className="order-item-return-btn"
                                          onClick={() => handleOpenReturnModal(order, it)}
                                        >
                                          ↺ Request Return
                                        </button>
                                      )}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>

                        {/* ORDER FOOTER / SHIPPING / TOTALS */}
                        <div className="order-card-footer">
                          <div className="order-shipping-summary">
                            <span className="footer-label">DELIVERY DESTINATION</span>
                            <p className="shipping-address-line">
                              <strong>{order.shippingAddress?.fullName || user?.name}</strong>
                              {order.shippingAddress?.phone && (
                                <span> • {order.shippingAddress.phone}</span>
                              )}
                              <br />
                              {[
                                order.shippingAddress?.house,
                                order.shippingAddress?.street || order.shippingAddress?.addressLine,
                                order.shippingAddress?.city,
                                order.shippingAddress?.state,
                                order.shippingAddress?.pincode,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                            <button
                              type="button"
                              className="order-footer-invoice-link"
                              onClick={() => handleDownloadInvoice(order._id, order.orderNumber)}
                              disabled={downloadingInvoiceId === order._id}
                            >
                              <span>{downloadingInvoiceId === order._id ? "⌛" : "📄"}</span>
                              <span>{downloadingInvoiceId === order._id ? "Generating PDF..." : "Download Official Tax Invoice (PDF)"}</span>
                            </button>
                          </div>

                          <div className="order-financial-breakdown">
                            <div className="breakdown-row">
                              <span>Subtotal ({order.items?.length || 0} flacons)</span>
                              <span>{formatPrice(order.subtotal)}</span>
                            </div>
                            <div className="breakdown-row">
                              <span>Atelier Shipping</span>
                              <span>
                                {order.shippingCost === 0 ? "Complimentary" : formatPrice(order.shippingCost)}
                              </span>
                            </div>
                            <div className="breakdown-row">
                              <span>Payment Method</span>
                              <span>{order.paymentMethod === "COD" ? "Cash on Delivery" : order.paymentMethod === "Razorpay" ? "Razorpay Online" : order.paymentMethod} ({order.paymentStatus || "Pending"})</span>
                            </div>
                            {order.razorpayPaymentId && (
                              <div className="breakdown-row">
                                <span>Razorpay Payment ID</span>
                                <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "#6a4f82" }}>
                                  {order.razorpayPaymentId}
                                </span>
                              </div>
                            )}
                            <div className="breakdown-divider" />
                            <div className="breakdown-row total">
                              <span>Total Paid / Due</span>
                              <strong>{formatPrice(order.totalAmount)}</strong>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* WISHLIST TAB */}
          {activeTab === "wishlist" && (
            <section className="tab-section-card">
              <div className="tab-card-header">
                <span>CURATED SELECTION</span>
                <h2>Wishlist</h2>
              </div>
              <div className="tab-content-placeholder">
                <div className="placeholder-icon">♡</div>
                <h3>8 Curated Flacons</h3>
                <p>Your saved fragrances and haute parfumerie wishlist items.</p>
              </div>
            </section>
          )}

          {/* WALLET TAB */}
          {activeTab === "wallet" && (
            <section className="wallet-section-container">
              {/* BALANCE HERO CARD */}
              <div className="wallet-hero-card">
                <div className="wallet-hero-header">
                  <span className="wallet-badge-tag">⚜️ FEXA ATELIER WALLET</span>
                  <button
                    type="button"
                    className="wallet-refresh-btn"
                    onClick={fetchWalletData}
                    disabled={walletLoading}
                    title="Refresh wallet balance"
                  >
                    <span>{walletLoading ? "⌛" : "↻"}</span>
                    <span>Refresh Balance</span>
                  </button>
                </div>

                <div className="wallet-balance-row">
                  <span className="wallet-balance-label">CURRENT AVAILABLE BALANCE</span>
                  <div className="wallet-balance-amount">
                    {formatPrice(walletBalance)}
                  </div>
                  <p className="wallet-balance-subtext">
                    Authoritative credits for fragrance acquisitions, product cancellations, and return refunds.
                  </p>
                </div>

                <div className="wallet-summary-metrics-row">
                  <div className="wallet-metric-item">
                    <span className="wallet-metric-label">TOTAL CREDITED</span>
                    <span className="wallet-metric-val credited">+{formatPrice(walletTotalCredited)}</span>
                  </div>
                  <div className="wallet-metric-divider" />
                  <div className="wallet-metric-item">
                    <span className="wallet-metric-label">TOTAL DEBITED</span>
                    <span className="wallet-metric-val debited">-{formatPrice(walletTotalDebited)}</span>
                  </div>
                </div>
              </div>

              {/* ADD MONEY TOP-UP CARD */}
              <div className="wallet-topup-card">
                <h3><span>💳</span> Add Money to Wallet</h3>
                <p>
                  Instant balance top-up via UPI, Cards, NetBanking, and online methods. Funds are immediately available for luxury flacon checkout.
                </p>

                {/* Quick amount chips */}
                <div className="wallet-quick-chips">
                  {[500, 1000, 2500, 5000].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className={`wallet-chip-btn ${Number(topUpAmount) === chip ? "active" : ""}`}
                      onClick={() => {
                        setTopUpAmount(String(chip));
                        setTopUpError("");
                      }}
                    >
                      +₹{chip.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>

                {/* Amount input & action */}
                <form onSubmit={handleInitiateTopUp} className="wallet-input-row">
                  <div className="wallet-amount-input-wrap">
                    <span className="wallet-currency-symbol">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="10"
                      max="100000"
                      placeholder="Enter amount (min ₹10.00)"
                      value={topUpAmount}
                      onChange={(e) => {
                        setTopUpAmount(e.target.value);
                        setTopUpError("");
                      }}
                      className="wallet-amount-input"
                      disabled={topUpProcessing}
                    />
                  </div>

                  <button
                    type="submit"
                    className="wallet-submit-topup-btn"
                    disabled={topUpProcessing || !topUpAmount}
                  >
                    <span>{topUpProcessing ? "Opening Gateway..." : "Proceed to Add Money →"}</span>
                  </button>
                </form>

                {topUpError && (
                  <span className="wallet-validation-error">⚠️ {topUpError}</span>
                )}
              </div>

              {/* TRANSACTIONS HISTORY CARD */}
              <div className="wallet-transactions-card">
                <div className="wallet-tx-header">
                  <h3>📜 Transaction History</h3>
                  <div className="wallet-tx-filters">
                    {["All", "Cancellation Refund", "Return Refund", "Top-up", "Purchase Debit"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`tx-filter-pill ${walletTxFilter === t ? "active" : ""}`}
                        onClick={() => {
                          setWalletTxFilter(t);
                          setWalletTxPage(1);
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {walletLoading ? (
                  <p style={{ textAlign: "center", padding: "30px", color: "#765493" }}>
                    Loading transactions...
                  </p>
                ) : walletTransactions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "#6f6475" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "8px" }}>👛</div>
                    <h4 style={{ margin: "0 0 4px", color: "#2e2535" }}>No Transactions Yet</h4>
                    <p style={{ margin: 0, fontSize: "13px" }}>
                      Top up your wallet or return an eligible fragrance to see transactions here.
                    </p>
                  </div>
                ) : (
                  <div className="wallet-table-wrap">
                    <table className="wallet-tx-table">
                      <thead>
                        <tr>
                          <th>Direction & Type</th>
                          <th>Description & Reference</th>
                          <th>Date & Time</th>
                          <th>Balance After</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {walletTransactions.map((tx) => {
                          const isCredit = String(tx.direction || "").trim().toUpperCase() === "CREDIT" || tx.direction === "Credit";
                          const formatTxType = (t) => {
                            const s = String(t || "").trim().toUpperCase().replace(/[- ]/g, "_");
                            if (s === "TOPUP" || s === "TOP_UP") return "Top-up";
                            if (s === "REFUND" || s === "RETURN_REFUND") return "Return Refund";
                            if (s === "PURCHASE" || s === "PURCHASE_DEBIT" || s === "DEBIT") return "Purchase Debit";
                            if (s === "CANCELLATION" || s === "CANCELLATION_REFUND") return "Cancellation Refund";
                            if (s === "ADMIN_ADJUSTMENT" || s === "ADJUSTMENT") return "Admin Adjustment";
                            return t || "Transaction";
                          };

                          return (
                            <tr key={tx.transactionId || tx._id}>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <span className={`tx-badge-direction ${isCredit ? "credit" : "debit"}`}>
                                    {isCredit ? "+ CREDIT" : "- DEBIT"}
                                  </span>
                                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#4b3f54" }}>
                                    {formatTxType(tx.type)}
                                  </span>
                                  <span style={{ fontSize: "10px", fontWeight: 600, color: tx.status === "Failed" ? "#dc2626" : tx.status === "Pending" ? "#d97706" : "#16a34a" }}>
                                    ● {tx.status || "Completed"}
                                  </span>
                                </div>
                              </td>

                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                  <span style={{ fontWeight: 600, color: "#2e2535" }}>
                                    {tx.description}
                                  </span>
                                  {tx.productName && (
                                    <span style={{ fontSize: "12px", color: "#765493", fontWeight: 500 }}>
                                      📦 {tx.productName}
                                    </span>
                                  )}
                                  <span className="tx-meta-sub">
                                    Ref: <span className="tx-id-tag">{tx.transactionId}</span>
                                    {tx.referenceId && tx.referenceId !== tx.transactionId && (
                                      <span style={{ marginLeft: "6px", color: "#8a7e93" }}>({tx.referenceId})</span>
                                    )}
                                  </span>
                                </div>
                              </td>

                              <td style={{ fontSize: "12px", color: "#6f6475" }}>
                                {tx.createdAt
                                  ? new Date(tx.createdAt).toLocaleDateString("en-IN", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "Recently"}
                              </td>

                              <td style={{ fontWeight: 600, color: "#4b3f54" }}>
                                {formatPrice(tx.balanceAfter)}
                              </td>

                              <td>
                                <span className={`tx-amount-text ${isCredit ? "credit" : "debit"}`}>
                                  {isCredit ? "+" : "-"}{formatPrice(tx.amount)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {walletTxPagination.totalPages > 1 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "16px",
                      paddingTop: "14px",
                      borderTop: "1px solid #eee8f1",
                      fontSize: "12px",
                      color: "#6f6475",
                    }}
                  >
                    <span>
                      Page <strong>{walletTxPagination.page}</strong> of{" "}
                      <strong>{walletTxPagination.totalPages}</strong> (
                      {walletTxPagination.totalTransactions} transactions)
                    </span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="user-return-cancel-btn"
                        onClick={() => setWalletTxPage((p) => Math.max(1, p - 1))}
                        disabled={walletTxPagination.page <= 1}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="user-return-cancel-btn"
                        onClick={() =>
                          setWalletTxPage((p) => Math.min(walletTxPagination.totalPages, p + 1))
                        }
                        disabled={walletTxPagination.page >= walletTxPagination.totalPages}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* MY RETURNS TAB */}
          {activeTab === "returns" && (
            <section className="returns-portal-container">
              {/* BANNER */}
              <div className="returns-portal-banner">
                <div className="returns-banner-info">
                  <h3>🔄 Concierge Return Management & Wallet Refunds</h3>
                  <p>
                    Return eligible flacons within your order return window. Upon review and approval by our atelier concierge, verified refunds are credited directly to your FEXA Wallet.
                  </p>
                </div>
                <button
                  type="button"
                  className="request-new-return-btn"
                  onClick={fetchEligibleReturnItems}
                  disabled={eligibleLoading}
                >
                  <span>{eligibleLoading ? "Finding Items..." : "↺ Request Item Return"}</span>
                </button>
              </div>

              {/* RETURNS LIST */}
              {returnsLoading ? (
                <p style={{ textAlign: "center", padding: "40px", color: "#765493" }}>
                  Loading your return manifests...
                </p>
              ) : customerReturns.length === 0 ? (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e5d8ee",
                    borderRadius: "14px",
                    padding: "48px 24px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📦</div>
                  <h3 style={{ fontSize: "1.25rem", color: "#2e2535", margin: "0 0 6px" }}>
                    No Active Return Requests
                  </h3>
                  <p style={{ color: "#6f6475", fontSize: "13px", maxWidth: "450px", margin: "0 auto 20px" }}>
                    You have not submitted any return requests. Returns can be initiated for fragrances from any of your delivered orders.
                  </p>
                  <button
                    type="button"
                    className="request-new-return-btn"
                    onClick={fetchEligibleReturnItems}
                  >
                    Select an Item to Return →
                  </button>
                </div>
              ) : (
                <div className="user-returns-list">
                  {customerReturns.map((ret) => {
                    const statusClass = (ret.status || "requested")
                      .toLowerCase()
                      .replace(/\s+/g, "-");

                    return (
                      <div key={ret._id} className="user-return-request-card">
                        <div className="user-return-card-top">
                          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            <span className="user-return-id-tag">
                              RETURN #{ret.requestNumber}
                            </span>
                            <span style={{ fontSize: "12px", color: "#6f6475" }}>
                              • Order: <strong>{ret.orderNumber}</strong>
                            </span>
                          </div>

                          <span className={`return-status-badge ${statusClass}`}>
                            {ret.status}
                          </span>
                        </div>

                        <div className="user-return-card-body">
                          {ret.item?.image ? (
                            <img
                              src={getImageUrl(ret.item.image)}
                              alt={ret.item.productName}
                              className="user-return-prod-img"
                            />
                          ) : (
                            <div
                              className="user-return-prod-img"
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}
                            >
                              🧴
                            </div>
                          )}

                          <div className="user-return-prod-meta">
                            <h4 className="user-return-prod-title">
                              {ret.item?.productName}
                            </h4>
                            <div className="user-return-prod-sub">
                              Volume: <strong>{ret.item?.variantVolume || "100ml"}</strong> • Quantity:{" "}
                              <strong>{ret.item?.requestedQuantity || 1} unit(s)</strong>
                            </div>

                            <div className="user-return-reason-box">
                              <strong>Reason:</strong> {ret.returnReason}
                              {ret.customerNotes && (
                                <div style={{ marginTop: "4px", color: "#6f6475", fontStyle: "italic" }}>
                                  "{ret.customerNotes}"
                                </div>
                              )}
                            </div>

                            {ret.rejectionReason && (
                              <div
                                style={{
                                  background: "#fef2f2",
                                  border: "1px solid #fecaca",
                                  borderRadius: "6px",
                                  padding: "8px 12px",
                                  fontSize: "12px",
                                  color: "#dc2626",
                                  marginTop: "8px",
                                }}
                              >
                                <strong>Declined Reason:</strong> {ret.rejectionReason}
                              </div>
                            )}

                            {ret.status === "Refunded" && ret.walletTransactionId && (
                              <div
                                style={{
                                  background: "#ecfdf5",
                                  border: "1px solid #a7f3d0",
                                  borderRadius: "6px",
                                  padding: "8px 12px",
                                  fontSize: "12px",
                                  color: "#059669",
                                  marginTop: "8px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                }}
                              >
                                <span>
                                  ✓ Refund of {formatPrice(ret.actualRefundAmount || ret.eligibleRefundAmount)} credited to FEXA Wallet!
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab("wallet")}
                                  style={{
                                    background: "#059669",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: "4px",
                                    padding: "4px 8px",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  View in Wallet →
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="user-return-refund-box">
                            <div className="user-return-refund-label">
                              {ret.status === "Refunded" ? "REFUND CREDITED" : "ELIGIBLE REFUND"}
                            </div>
                            <div className="user-return-refund-val">
                              {formatPrice(ret.actualRefundAmount || ret.eligibleRefundAmount)}
                            </div>
                            <div className="user-return-refund-dest">
                              → FEXA Wallet
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* SECURITY TAB */}
          {activeTab === "security" && (
            <section className="tab-section-card">
              <div className="tab-card-header">
                <span>PROTECTION & PRIVACY</span>
                <h2>Security</h2>
              </div>
              <div className="tab-content-placeholder">
                <div className="placeholder-icon">🛡️</div>
                <h3>Account Security</h3>
                <p>Manage your password, 2-Step OTP authentication, and active user sessions.</p>
              </div>
            </section>
          )}

          {/* SETTINGS TAB */}
          {activeTab === "settings" && (
            <section className="tab-section-card">
              <div className="tab-card-header">
                <span>PREFERENCES</span>
                <h2>Account Settings</h2>
              </div>
              <div className="tab-content-placeholder">
                <div className="placeholder-icon">⚙️</div>
                <h3>Patron Preferences</h3>
                <p>Configure notification channels, shipping defaults, and atelier communications.</p>
              </div>
            </section>
          )}
        </div>
      </section>

      {/* LUXURY FOOTER */}
      <footer className="profile-footer">
        <div className="profile-footer-inner">
          <span>© 2026 FEXA Haute Parfumerie. Patron Privé Account Portal.</span>
        </div>
      </footer>

      {/* ========================================================
          INDIVIDUAL PRODUCT CANCELLATION CONFIRMATION MODAL
         ======================================================== */}
      {cancelModalItem && cancelModalOrder && (
        <div className="user-cancel-modal-overlay" onClick={handleCloseCancelModal}>
          <div className="user-cancel-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="user-cancel-modal-header">
              <div>
                <span className="cancel-modal-eyebrow">ORDER MODIFICATION // ITEM CANCELLATION</span>
                <h3>Cancel Fragrance: {cancelModalItem.name}</h3>
              </div>
              <button
                type="button"
                className="user-cancel-modal-close"
                onClick={handleCloseCancelModal}
                disabled={submittingCancel}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCancel} className="user-cancel-modal-body">
              {/* Product preview */}
              <div className="cancel-item-preview">
                {cancelModalItem.image ? (
                  <img
                    src={getImageUrl(cancelModalItem.image)}
                    alt={cancelModalItem.name}
                    className="cancel-item-preview-img"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                ) : (
                  <div className="cancel-item-preview-placeholder">🧴</div>
                )}
                <div className="cancel-item-preview-meta">
                  <h4>{cancelModalItem.name}</h4>
                  <p className="cancel-preview-sub">
                    {cancelModalItem.brand || "FEXA"} • {cancelModalItem.volumeMl ? `${cancelModalItem.volumeMl} ml Flacon` : "Fragrance"}
                  </p>
                  <p className="cancel-preview-qty">
                    Cancelling Quantity: <strong>{cancelModalItem.quantity} unit(s)</strong>
                  </p>
                </div>
              </div>

              {/* Financial & Refund breakdown */}
              <div className="cancel-financial-callout">
                <div className="callout-row">
                  <span>Item Net Paid Amount</span>
                  <strong>
                    {formatPrice(
                      cancelModalItem.discountedLineAmount ||
                      (cancelModalItem.lineTotal - (cancelModalItem.allocatedCouponDiscount || 0))
                    )}
                  </strong>
                </div>

                <div className="callout-row refund-highlight">
                  <span>Payment / Refund Mode</span>
                  <span className="refund-mode-tag">
                    {cancelModalOrder.paymentMethod === "Razorpay" && cancelModalOrder.paymentStatus === "Paid"
                      ? "Razorpay Online Gateway"
                      : "Cash on Delivery"}
                  </span>
                </div>

                {cancelModalOrder.paymentMethod === "Razorpay" && cancelModalOrder.paymentStatus === "Paid" ? (
                  <p className="callout-explanation">
                    ✓ A refund of{" "}
                    <strong>
                      {formatPrice(
                        cancelModalItem.discountedLineAmount ||
                        (cancelModalItem.lineTotal - (cancelModalItem.allocatedCouponDiscount || 0))
                      )}
                    </strong>{" "}
                    will be initiated directly to your original payment method (Card / UPI / NetBanking) upon confirmation.
                  </p>
                ) : (
                  <p className="callout-explanation">
                    ✓ As this is a Cash on Delivery order, no payment was charged. You will not be billed for this flacon upon delivery.
                  </p>
                )}
              </div>

              {/* Reason selection */}
              <div className="user-cancel-field">
                <label>Reason for Cancellation</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  disabled={submittingCancel}
                >
                  {CANCELLATION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {cancelReason === "Other" && (
                <div className="user-cancel-field">
                  <label>Additional Explanation</label>
                  <textarea
                    rows={2}
                    placeholder="Briefly state your reason for cancelling this flacon..."
                    value={cancelCustomerNotes}
                    onChange={(e) => setCancelCustomerNotes(e.target.value)}
                    disabled={submittingCancel}
                  />
                </div>
              )}

              {/* Alerts */}
              {cancelErrorMsg && (
                <div className="cancel-modal-error-alert">
                  <span>✕ {cancelErrorMsg}</span>
                </div>
              )}
              {cancelSuccessMsg && (
                <div className="cancel-modal-success-alert">
                  <span>✓ {cancelSuccessMsg}</span>
                </div>
              )}

              <div className="user-cancel-modal-footer">
                <button
                  type="button"
                  className="cancel-modal-dismiss-btn"
                  onClick={handleCloseCancelModal}
                  disabled={submittingCancel}
                >
                  Keep Flacon
                </button>
                <button
                  type="submit"
                  className="cancel-modal-confirm-btn"
                  disabled={submittingCancel}
                >
                  {submittingCancel ? "Cancelling Flacon..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          CUSTOMER ITEM RETURN MODAL (WITH 8 STANDARDIZED REASONS)
         ======================================================== */}
      {returnModalItem && returnModalOrder && (
        <div className="user-return-modal-overlay" onClick={handleCloseReturnModal}>
          <div className="user-return-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="user-return-modal-header">
              <div>
                <span className="return-modal-eyebrow">FEXA CONCIERGE RETURN</span>
                <h3>Return Item: {returnModalItem.name || returnModalItem.productName}</h3>
              </div>
              <button
                type="button"
                className="user-return-modal-close"
                onClick={handleCloseReturnModal}
                disabled={submittingReturn}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="user-return-modal-body">
              <div className="user-return-product-summary">
                <p>
                  <strong>Variant:</strong> {returnModalItem.volumeMl ? `${returnModalItem.volumeMl} ml Flacon` : returnModalItem.variantVolume || "Standard Flacon"}
                </p>
                <p>
                  <strong>Purchased Quantity:</strong> {returnModalItem.quantity || returnModalItem.purchasedQuantity} unit(s)
                  {(returnModalItem.returnedQuantity > 0) && ` (${returnModalItem.returnedQuantity} already returned)`}
                </p>
                <p>
                  <strong>Eligible for Return:</strong> {returnModalItem.availableQuantity !== undefined ? returnModalItem.availableQuantity : ((returnModalItem.quantity || 1) - (returnModalItem.returnedQuantity || 0))} unit(s)
                </p>
              </div>

              {/* Quantity selector */}
              <div className="user-return-form-group">
                <label>Select Quantity to Return:</label>
                <select
                  value={returnQuantity}
                  onChange={(e) => setReturnQuantity(Number(e.target.value))}
                  disabled={submittingReturn}
                >
                  {Array.from(
                    {
                      length: returnModalItem.availableQuantity !== undefined
                        ? returnModalItem.availableQuantity
                        : Math.max(1, (returnModalItem.quantity || 1) - (returnModalItem.returnedQuantity || 0)),
                    },
                    (_, i) => i + 1
                  ).map((qty) => (
                    <option key={qty} value={qty}>
                      {qty} unit{qty > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Authoritative Refund Calculation Card */}
              <div className="user-return-calc-card" style={{ flexDirection: "column", gap: "6px", alignItems: "stretch" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#6f6475" }}>
                  <span>Unit Selling Price:</span>
                  <span>{formatPrice(returnModalItem.unitPrice)}</span>
                </div>
                {returnModalItem.perUnitOfferDiscount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#0284c7" }}>
                    <span>- Automatic Offer Discount:</span>
                    <span>-{formatPrice(returnModalItem.perUnitOfferDiscount)}</span>
                  </div>
                )}
                {(returnModalItem.allocatedCouponDiscount > 0 || returnModalItem.perUnitCouponDiscount > 0) && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#765493" }}>
                    <span>- Allocated Coupon Discount:</span>
                    <span>-{formatPrice(returnModalItem.perUnitCouponDiscount || returnModalItem.perUnitDiscount || (returnModalItem.allocatedCouponDiscount / (returnModalItem.quantity || 1)))}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, color: "#2e2535", paddingTop: "4px", borderTop: "1px solid #e5d8ee" }}>
                  <span>Net Paid Per Unit:</span>
                  <span>{formatPrice(returnModalItem.discountedUnitAmount || returnModalItem.unitPrice)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "6px",
                    paddingTop: "6px",
                    borderTop: "1px dashed rgba(118, 84, 147, 0.25)",
                    fontSize: "1rem",
                    color: "#059669",
                    fontWeight: 800,
                  }}
                >
                  <span>Refund to FEXA Wallet:</span>
                  <span>
                    {formatPrice(returnQuantity * (returnModalItem.discountedUnitAmount || returnModalItem.unitPrice))}
                  </span>
                </div>
              </div>

              {/* Standardized 8 Return Reasons Dropdown */}
              <div className="user-return-form-group">
                <label>Reason for Return: *</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  disabled={submittingReturn}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #d4c1e6",
                    background: "#ffffff",
                    fontSize: "13px",
                    color: "#2e2535",
                  }}
                >
                  {RETURN_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Additional Details */}
              <div className="user-return-form-group">
                <label>
                  Additional Explanation {returnReason === "Other" ? "(Required for 'Other') *" : "(Optional)"}:
                </label>
                <textarea
                  rows="3"
                  required={returnReason === "Other"}
                  placeholder={
                    returnReason === "Other"
                      ? "Please explain your return request in detail (min 5 characters)..."
                      : "Provide any additional context for our inspection team..."
                  }
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  disabled={submittingReturn}
                />
              </div>

              {returnErrorMsg && (
                <div style={{ color: "#dc2626", fontSize: "12px", background: "#fef2f2", padding: "8px 12px", borderRadius: "6px" }}>
                  ⚠️ {returnErrorMsg}
                </div>
              )}

              {returnSuccessMsg && (
                <div style={{ color: "#059669", fontSize: "12px", background: "#ecfdf5", padding: "8px 12px", borderRadius: "6px" }}>
                  ✓ {returnSuccessMsg}
                </div>
              )}

              <div className="user-return-modal-footer">
                <button
                  type="button"
                  className="user-return-cancel-btn"
                  onClick={handleCloseReturnModal}
                  disabled={submittingReturn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="user-return-submit-btn"
                  disabled={submittingReturn}
                >
                  {submittingReturn ? "Submitting Manifest..." : "Submit Return Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          ELIGIBLE RETURN ITEMS PICKER MODAL
         ======================================================== */}
      {isEligiblePickerOpen && (
        <div className="user-return-modal-overlay" onClick={() => setIsEligiblePickerOpen(false)}>
          <div className="user-return-modal-card" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="user-return-modal-header">
              <div>
                <span className="return-modal-eyebrow">SELECT A DELIVERED FLACON</span>
                <h3>Eligible Fragrances for Return</h3>
              </div>
              <button
                type="button"
                className="user-return-modal-close"
                onClick={() => setIsEligiblePickerOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="user-return-modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              {eligibleItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "#6f6475" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📦</div>
                  <h4 style={{ margin: "0 0 6px", color: "#2e2535" }}>No Eligible Items Found</h4>
                  <p style={{ margin: 0, fontSize: "13px" }}>
                    Returns are only permitted for delivered orders with unreturned units.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {eligibleItems.map((el) => (
                    <div
                      key={`${el.orderId}-${el.itemId}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid #e5d8ee",
                        background: "#ffffff",
                      }}
                    >
                      {el.image ? (
                        <img
                          src={getImageUrl(el.image)}
                          alt={el.productName}
                          style={{ width: "50px", height: "50px", borderRadius: "6px", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{ fontSize: "1.8rem" }}>🧴</div>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "#2e2535", fontSize: "14px" }}>
                          {el.productName}
                        </div>
                        <div style={{ fontSize: "12px", color: "#765493" }}>
                          Order #{el.orderNumber} • Size: {el.variantVolume}
                        </div>
                        <div style={{ fontSize: "11px", color: "#6f6475" }}>
                          Available to return: <strong>{el.availableQuantity} unit(s)</strong> • Net:{" "}
                          <strong>{formatPrice(el.discountedUnitAmount)}</strong> / unit
                        </div>
                      </div>

                      <button
                        type="button"
                        className="user-return-submit-btn"
                        style={{ padding: "6px 14px", fontSize: "11px" }}
                        onClick={() => {
                          handleOpenReturnModal(
                            { _id: el.orderId, orderNumber: el.orderNumber },
                            {
                              _id: el.itemId,
                              name: el.productName,
                              productName: el.productName,
                              volumeMl: el.volumeMl,
                              variantVolume: el.variantVolume,
                              quantity: el.purchasedQuantity,
                              returnedQuantity: el.returnedQuantity,
                              availableQuantity: el.availableQuantity,
                              unitPrice: el.unitPrice,
                              perUnitOfferDiscount: el.perUnitOfferDiscount,
                              perUnitCouponDiscount: el.perUnitCouponDiscount,
                              discountedUnitAmount: el.discountedUnitAmount,
                            }
                          );
                        }}
                      >
                        Select Flacon →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TOP-UP SUCCESS CELEBRATION MODAL
         ======================================================== */}
      {topUpSuccessModal && (
        <div className="user-success-dialog-overlay" onClick={() => setTopUpSuccessModal(null)}>
          <div className="user-success-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="user-success-icon">✨👛✨</div>
            <h3>Wallet Top-Up Successful!</h3>
            <p>
              An amount of <strong>{formatPrice(topUpSuccessModal.amount)}</strong> has been
              successfully credited to your FEXA Atelier Wallet.
            </p>
            <div
              style={{
                background: "#f4eef9",
                border: "1px solid #d4c1e6",
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "11px", color: "#6f6475", textTransform: "uppercase" }}>
                Updated Wallet Balance
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#765493" }}>
                {formatPrice(topUpSuccessModal.balance)}
              </div>
              <div style={{ fontSize: "11px", color: "#7a6b85", marginTop: "4px", fontFamily: "monospace" }}>
                Ref: {topUpSuccessModal.transactionId}
              </div>
            </div>
            <button
              type="button"
              className="user-success-close-btn"
              onClick={() => setTopUpSuccessModal(null)}
            >
              Done & Return to Wallet
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default Profile;
