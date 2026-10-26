import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import UserSidebar from "../../components/user/UserSidebar";
import Navbar from "../../components/common/Navbar";
import { validateAddressField, validateAddressForm, validateName, normalizeName } from "../../utils/validation";

import "./profile.css";

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

  useEffect(() => {
    fetchOrders();
  }, []);

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

  const handleSave = async () => {
    try {
      setError("");
      setSuccessMessage("");

      setNameTouched(true);
      const validationError = validateName(name);
      if (validationError) {
        setNameError(validationError);
        document.getElementById("profile-name-input")?.focus();
        return;
      }

      setSaving(true);

      const normalizedName = normalizeName(name);

      const response = await fetch("http://localhost:5000/api/profile", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: normalizedName,
          phone: phone.trim(),
          email: email.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout();
          navigate("/login");
          return;
        }

        if (data.errors && data.errors.name) {
          setNameError(data.errors.name);
          setNameTouched(true);
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
              <div className="stat-card-value">₹2,500</div>
              <div className="stat-card-subtext">Atelier Credits</div>
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
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            disabled={saving || Boolean(pendingEmail)}
                          />
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
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Enter your phone number"
                      />
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
                    const statusClass =
                      order.orderStatus === "Delivered"
                        ? "status-delivered"
                        : order.orderStatus === "Dispatched"
                        ? "status-dispatched"
                        : order.orderStatus === "Cancelled"
                        ? "status-cancelled"
                        : "status-processing";

                    const statusIcon =
                      order.orderStatus === "Delivered"
                        ? "✓"
                        : order.orderStatus === "Dispatched"
                        ? "✈"
                        : order.orderStatus === "Cancelled"
                        ? "✕"
                        : "●";

                    // Determine step progress (0 to 3)
                    const currentStep =
                      order.orderStatus === "Delivered"
                        ? 3
                        : order.orderStatus === "Dispatched"
                        ? 2
                        : order.orderStatus === "Cancelled"
                        ? -1
                        : 1;

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
                          </div>
                        </div>

                        {/* LIVE TRACKING PROGRESS BAR (Only if not cancelled) */}
                        {order.orderStatus !== "Cancelled" ? (
                          <div className="order-tracker-container">
                            <div className="order-tracker-bar">
                              <div
                                className="order-tracker-progress"
                                style={{
                                  width:
                                    currentStep === 3
                                      ? "100%"
                                      : currentStep === 2
                                      ? "66%"
                                      : "33%",
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
                        ) : (
                          <div className="order-cancelled-notice">
                            <span>✕ This order has been cancelled and vault reservation released.</span>
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
                                    <span className="order-item-line-total">
                                      {formatPrice(it.lineTotal)}
                                    </span>
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
            <section className="tab-section-card">
              <div className="tab-card-header">
                <span>ATELIER CREDITS</span>
                <h2>FEXA Wallet</h2>
              </div>
              <div className="tab-content-placeholder">
                <div className="placeholder-icon">👛</div>
                <h3>₹2,500 Available Credits</h3>
                <p>Use your FEXA Atelier wallet credits on your next luxury order.</p>
              </div>
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
    </main>
  );
}

export default Profile;
