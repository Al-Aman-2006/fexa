import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminPagination from "../../components/admin/AdminPagination";
import "./AdminDashboard.css";
import "./AdminOffers.css";

function AdminOffers() {
  const { admin, logoutAdmin } = useAdminAuth();
  const location = useLocation();

  const [offers, setOffers] = useState([]);
  const [stats, setStats] = useState({
    totalOffers: 0,
    activeOffers: 0,
    expiredOffers: 0,
    upcomingOffers: 0,
    inactiveOffers: 0,
    totalOrdersWithOffer: 0,
    totalOfferSavings: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalOffers: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [scopeFilter, setScopeFilter] = useState("All");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Sidebar responsive state
  const [activeTab, setActiveTab] = useState("offers");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modal State: null | "create" | "edit" | "delete"
  const [activeModal, setActiveModal] = useState(null);
  const [modalOffer, setModalOffer] = useState(null);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Product selector search states for Specific Product / Selected Products
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [selectedProductsList, setSelectedProductsList] = useState([]);

  const defaultFormData = {
    name: "",
    description: "",
    discountType: "Percentage",
    discountValue: 20,
    scope: "all", // "all" | "category" | "product" | "products"
    category: "Men",
    productId: null,
    productIds: [],
    minPurchaseAmount: "",
    maxDiscount: "",
    startDate: "",
    endDate: "",
    isActive: true,
    priority: 0,
  };

  const [formData, setFormData] = useState(defaultFormData);

  // Format Date for datetime-local input (YYYY-MM-DDTHH:mm)
  const toDateTimeLocal = (dateVal) => {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Fetch offers from backend API
  const fetchOffers = useCallback(
    async (targetPage = 1, targetSearch = "", targetStatus = "All", targetScope = "All") => {
      try {
        setLoading(true);
        const queryParams = new URLSearchParams({
          page: targetPage.toString(),
          limit: "10",
        });

        if (targetSearch.trim()) queryParams.set("search", targetSearch.trim());
        if (targetStatus && targetStatus !== "All") queryParams.set("status", targetStatus);
        if (targetScope && targetScope !== "All") queryParams.set("scope", targetScope);

        const res = await fetch(`http://localhost:5000/api/admin/offers?${queryParams.toString()}`, {
          credentials: "include",
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setOffers(data.offers || []);
          if (data.stats) setStats(data.stats);
          if (data.pagination) setPagination(data.pagination);
        } else {
          setToast({
            type: "error",
            text: data.message || "Failed to load offer catalogue.",
          });
        }
      } catch (err) {
        console.error("Fetch admin offers error:", err);
        setToast({
          type: "error",
          text: "Unable to connect to server. Please check your connection.",
        });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchOffers(page, appliedSearch, statusFilter, scopeFilter);
  }, [page, appliedSearch, statusFilter, scopeFilter, fetchOffers]);

  // Search products for scope selector
  const searchCatalogueProducts = useCallback(async (queryStr) => {
    try {
      setProductSearchLoading(true);
      const params = new URLSearchParams();
      if (queryStr) params.set("search", queryStr);

      const res = await fetch(
        `http://localhost:5000/api/admin/offers/search-products?${params.toString()}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setProductSearchResults(data.products || []);
      }
    } catch (err) {
      console.error("Search products error:", err);
    } finally {
      setProductSearchLoading(false);
    }
  }, []);

  // When modal opens or search query changes, run product search
  useEffect(() => {
    if (activeModal === "create" || activeModal === "edit") {
      const timer = setTimeout(() => {
        searchCatalogueProducts(productSearchQuery);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [productSearchQuery, activeModal, searchCatalogueProducts]);

  // Handle Search Input submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(search);
  };

  const handleClearSearch = () => {
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const now = new Date();
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    setFormData({
      ...defaultFormData,
      startDate: toDateTimeLocal(now),
      endDate: toDateTimeLocal(twoWeeksLater),
    });
    setSelectedProductDetails(null);
    setSelectedProductsList([]);
    setProductSearchQuery("");
    setFormErrors({});
    setTouched({});
    setActiveModal("create");
  };

  // Open Edit Modal
  const handleOpenEditModal = (off) => {
    setModalOffer(off);

    setFormData({
      name: off.name || "",
      description: off.description || "",
      discountType: off.discountType || "Percentage",
      discountValue: off.discountValue !== undefined ? off.discountValue : 20,
      scope: off.scope || "all",
      category: off.category || "Men",
      productId: off.productId?._id || off.productId || null,
      productIds: Array.isArray(off.productIds)
        ? off.productIds.map((p) => p._id || p)
        : [],
      minPurchaseAmount: off.minPurchaseAmount > 0 ? off.minPurchaseAmount : "",
      maxDiscount: off.maxDiscount > 0 ? off.maxDiscount : "",
      startDate: toDateTimeLocal(off.startDate),
      endDate: toDateTimeLocal(off.endDate),
      isActive: Boolean(off.isActive),
      priority: off.priority || 0,
    });

    if (off.scope === "product" && off.productId) {
      setSelectedProductDetails(off.productId);
    } else {
      setSelectedProductDetails(null);
    }

    if (off.scope === "products" && Array.isArray(off.productIds)) {
      setSelectedProductsList(off.productIds);
    } else {
      setSelectedProductsList([]);
    }

    setProductSearchQuery("");
    setFormErrors({});
    setTouched({});
    setActiveModal("edit");
  };

  // Open Delete / Archive Confirmation Modal
  const handleOpenDeleteModal = (off) => {
    setModalOffer(off);
    setActiveModal("delete");
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setModalOffer(null);
    setFormErrors({});
    setTouched({});
    setActionProcessing(false);
  };

  // Field-level validator
  const validateSingleField = (field, value, currentFormData = formData) => {
    let error = "";

    switch (field) {
      case "name": {
        const clean = typeof value === "string" ? value.trim() : "";
        if (!clean) {
          error = "Please enter a valid offer name.";
        } else if (clean.length < 3) {
          error = "Offer name must be at least 3 characters.";
        } else if (clean.length > 120) {
          error = "Offer name cannot exceed 120 characters.";
        } else if (/^\d+$/.test(clean)) {
          error = "Offer name cannot consist entirely of numbers.";
        } else if (!/[a-zA-Z]/.test(clean)) {
          error = "Offer name must contain at least one letter.";
        }
        break;
      }

      case "description": {
        if (value && typeof value === "string" && value.trim().length > 300) {
          error = "Description cannot exceed 300 characters.";
        }
        break;
      }

      case "discountValue": {
        const raw = String(value !== undefined && value !== null ? value : "").trim();
        if (!raw) {
          error = "Discount value is required.";
        } else {
          const num = Number(raw);
          if (isNaN(num) || !Number.isFinite(num) || num <= 0) {
            error = "Discount value must be a valid positive number.";
          } else if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
            error = "Discount value cannot have more than 2 decimal places.";
          } else if (currentFormData.discountType === "Percentage" && (num < 1 || num > 100)) {
            error = "Discount percentage must be between 1% and 100%.";
          }
        }
        break;
      }

      case "category": {
        if (currentFormData.scope === "category") {
          if (!value || !["Men", "Women", "Unisex"].includes(value)) {
            error = "Please select a valid category.";
          }
        }
        break;
      }

      case "productId": {
        if (currentFormData.scope === "product") {
          if (!value) {
            error = "Please select a valid existing product.";
          }
        }
        break;
      }

      case "productIds": {
        if (currentFormData.scope === "products") {
          if (!Array.isArray(value) || value.length === 0) {
            error = "Please select at least one product.";
          }
        }
        break;
      }

      case "startDate": {
        if (!value) {
          error = "Start date and time is required.";
        } else {
          const d = new Date(value);
          if (isNaN(d.getTime())) {
            error = "Please enter a valid start date.";
          }
        }
        break;
      }

      case "endDate": {
        if (!value) {
          error = "Expiration date and time is required.";
        } else {
          const d = new Date(value);
          if (isNaN(d.getTime())) {
            error = "Please enter a valid expiry date.";
          } else if (currentFormData.startDate) {
            const s = new Date(currentFormData.startDate).getTime();
            const e = d.getTime();
            if (e <= s) {
              error = "Expiry date must be later than the start date.";
            }
          }
        }
        break;
      }

      case "minPurchaseAmount": {
        if (value !== "" && value !== null && value !== undefined) {
          const raw = String(value).trim();
          const num = Number(raw);
          if (isNaN(num) || !Number.isFinite(num) || num < 0) {
            error = "Minimum purchase amount cannot be negative.";
          } else if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
            error = "Amount cannot have more than 2 decimal places.";
          }
        }
        break;
      }

      case "maxDiscount": {
        if (value !== "" && value !== null && value !== undefined) {
          const raw = String(value).trim();
          const num = Number(raw);
          if (isNaN(num) || !Number.isFinite(num) || num <= 0) {
            error = "Maximum discount cap must be greater than zero.";
          } else if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
            error = "Cap cannot have more than 2 decimal places.";
          }
        }
        break;
      }

      default:
        break;
    }

    return error;
  };

  // Blur handler for individual fields
  const handleFieldBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateSingleField(field, formData[field], formData);
    setFormErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  };

  // Change handler for form fields with real-time touched validation
  const handleFieldChange = (field, value) => {
    const updatedForm = { ...formData, [field]: value };
    setFormData(updatedForm);

    if (touched[field]) {
      const err = validateSingleField(field, value, updatedForm);
      setFormErrors((prev) => {
        const next = { ...prev };
        if (err) next[field] = err;
        else delete next[field];
        return next;
      });
    }

    // Dependent field cross-validation:
    if (field === "startDate" && touched.endDate) {
      const endErr = validateSingleField("endDate", updatedForm.endDate, updatedForm);
      setFormErrors((prev) => {
        const next = { ...prev };
        if (endErr) next.endDate = endErr;
        else delete next.endDate;
        return next;
      });
    }

    if (field === "discountType" && touched.discountValue) {
      const discErr = validateSingleField("discountValue", updatedForm.discountValue, updatedForm);
      setFormErrors((prev) => {
        const next = { ...prev };
        if (discErr) next.discountValue = discErr;
        else delete next.discountValue;
        return next;
      });
    }
  };

  // Scope selection change handler
  const handleScopeChange = (newScope) => {
    const updatedForm = {
      ...formData,
      scope: newScope,
      category: newScope === "category" ? (formData.category || "Men") : null,
      productId: newScope === "product" ? formData.productId : null,
      productIds: newScope === "products" ? formData.productIds : [],
    };
    setFormData(updatedForm);

    // Clear irrelevant scope errors
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.scope;
      if (newScope !== "category") delete next.category;
      if (newScope !== "product") delete next.productId;
      if (newScope !== "products") delete next.productIds;
      return next;
    });
  };

  // Full validation before submission
  const validateAll = (data) => {
    const errors = {};

    setTouched({
      name: true,
      description: true,
      discountType: true,
      discountValue: true,
      scope: true,
      category: true,
      productId: true,
      productIds: true,
      startDate: true,
      endDate: true,
      minPurchaseAmount: true,
      maxDiscount: true,
    });

    const nameErr = validateSingleField("name", data.name, data);
    if (nameErr) errors.name = nameErr;

    const descErr = validateSingleField("description", data.description, data);
    if (descErr) errors.description = descErr;

    const discErr = validateSingleField("discountValue", data.discountValue, data);
    if (discErr) errors.discountValue = discErr;

    if (data.scope === "category") {
      const catErr = validateSingleField("category", data.category, data);
      if (catErr) errors.category = catErr;
    } else if (data.scope === "product") {
      const prodErr = validateSingleField("productId", data.productId, data);
      if (prodErr) errors.productId = prodErr;
    } else if (data.scope === "products") {
      const prodsErr = validateSingleField("productIds", data.productIds, data);
      if (prodsErr) errors.productIds = prodsErr;
    }

    const startErr = validateSingleField("startDate", data.startDate, data);
    if (startErr) errors.startDate = startErr;

    const endErr = validateSingleField("endDate", data.endDate, data);
    if (endErr) errors.endDate = endErr;

    const minErr = validateSingleField("minPurchaseAmount", data.minPurchaseAmount, data);
    if (minErr) errors.minPurchaseAmount = minErr;

    const maxErr = validateSingleField("maxDiscount", data.maxDiscount, data);
    if (maxErr) errors.maxDiscount = maxErr;

    setFormErrors(errors);
    return errors;
  };

  // Handle Create or Update submission
  const handleSaveOffer = async (e) => {
    e.preventDefault();
    if (actionProcessing) return; // Prevent double submission

    const errors = validateAll(formData);
    if (Object.keys(errors).length > 0) {
      setToast({
        type: "error",
        text: "Please correct the highlighted fields before saving.",
      });
      return;
    }

    try {
      setActionProcessing(true);

      const payload = {
        name: formData.name.trim(),
        description: formData.description ? formData.description.trim() : "",
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        scope: formData.scope,
        category: formData.scope === "category" ? formData.category : null,
        productId: formData.scope === "product" ? formData.productId : null,
        productIds: formData.scope === "products" ? formData.productIds : [],
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        isActive: Boolean(formData.isActive),
        minPurchaseAmount:
          formData.minPurchaseAmount !== "" && formData.minPurchaseAmount !== null
            ? Number(formData.minPurchaseAmount)
            : 0,
        maxDiscount:
          formData.maxDiscount !== "" && formData.maxDiscount !== null
            ? Number(formData.maxDiscount)
            : null,
        priority: Number(formData.priority) || 0,
      };

      const url =
        activeModal === "create"
          ? "http://localhost:5000/api/admin/offers"
          : `http://localhost:5000/api/admin/offers/${modalOffer._id}`;

      const method = activeModal === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setToast({
          type: "success",
          text: activeModal === "create" ? "Offer created successfully!" : "Offer updated successfully!",
        });
        handleCloseModal();
        fetchOffers(page, appliedSearch, statusFilter, scopeFilter);
      } else {
        if (data.errors) {
          setFormErrors((prev) => ({ ...prev, ...data.errors }));
        }
        setToast({
          type: "error",
          text: data.message || "Failed to save offer. Please check the inputs.",
        });
      }
    } catch (err) {
      console.error("Save offer error:", err);
      setToast({
        type: "error",
        text: "Network error occurred while saving offer.",
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Handle Quick Toggle Status
  const handleToggleStatus = async (off) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/offers/${off._id}/status`, {
        method: "PATCH",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setToast({
          type: "success",
          text: data.message || "Offer status updated.",
        });
        setOffers((prev) =>
          prev.map((item) =>
            item._id === off._id ? { ...item, isActive: data.isActive } : item
          )
        );
        fetchOffers(page, appliedSearch, statusFilter, scopeFilter);
      } else {
        setToast({
          type: "error",
          text: data.message || "Failed to toggle status.",
        });
      }
    } catch (err) {
      console.error("Toggle status error:", err);
      setToast({
        type: "error",
        text: "Unable to update offer status.",
      });
    }
  };

  // Handle Confirm Archive / Delete
  const handleConfirmDelete = async () => {
    if (!modalOffer) return;
    try {
      setActionProcessing(true);
      const res = await fetch(`http://localhost:5000/api/admin/offers/${modalOffer._id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setToast({
          type: "success",
          text: data.message || "Offer archived safely.",
        });
        handleCloseModal();
        fetchOffers(page, appliedSearch, statusFilter, scopeFilter);
      } else {
        setToast({
          type: "error",
          text: data.message || "Failed to remove offer.",
        });
      }
    } catch (err) {
      console.error("Delete offer error:", err);
      setToast({
        type: "error",
        text: "Network error while deleting offer.",
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Format Date for table display
  const formatDateDisplay = (dateVal) => {
    if (!dateVal) return "—";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Evaluate Offer Status tag
  const getOfferStatusTag = (off) => {
    const now = new Date().getTime();
    const start = new Date(off.startDate).getTime();
    const end = new Date(off.endDate).getTime();

    if (!off.isActive) {
      return <span className="offer-tag tag-inactive">INACTIVE</span>;
    }
    if (end < now) {
      return <span className="offer-tag tag-expired">EXPIRED</span>;
    }
    if (start > now) {
      return <span className="offer-tag tag-upcoming">UPCOMING</span>;
    }
    return <span className="offer-tag tag-active">ACTIVE NOW</span>;
  };

  // Scope label formatter
  const renderScopeBadge = (off) => {
    if (off.scope === "all") {
      return (
        <span className="scope-badge scope-all" title="Applies to all eligible catalogue products">
          <span className="scope-icon">🌐</span> All Products
        </span>
      );
    }
    if (off.scope === "category") {
      const cat = off.category || "General";
      return (
        <span className={`scope-badge scope-category scope-cat-${cat.toLowerCase()}`}>
          <span className="scope-icon">{cat === "Men" ? "🎩" : cat === "Women" ? "🌸" : "✨"}</span>{" "}
          Category: {cat}
        </span>
      );
    }
    if (off.scope === "product") {
      const prodName = off.productId?.name || "Single Product";
      return (
        <span className="scope-badge scope-product" title={prodName}>
          <span className="scope-icon">🎯</span> Product: {prodName}
        </span>
      );
    }
    if (off.scope === "products") {
      const count = Array.isArray(off.productIds) ? off.productIds.length : 0;
      return (
        <span className="scope-badge scope-products" title={`${count} products included`}>
          <span className="scope-icon">📦</span> {count} Selected Products
        </span>
      );
    }
    return <span className="scope-badge">{off.scope}</span>;
  };

  // Live simulation for preview card
  const sampleBasePrice = 1000;
  const simulatedDiscount = useMemo(() => {
    const val = Number(formData.discountValue) || 0;
    if (val <= 0) return 0;
    if (formData.discountType === "Percentage") {
      let calc = (sampleBasePrice * val) / 100;
      if (formData.maxDiscount && Number(formData.maxDiscount) > 0) {
        calc = Math.min(calc, Number(formData.maxDiscount));
      }
      return Math.round(calc);
    } else {
      return Math.min(val, sampleBasePrice);
    }
  }, [formData.discountValue, formData.discountType, formData.maxDiscount]);

  return (
    <div className="admin-dashboard-page">
      {/* ADMIN PERMANENT SIDEBAR */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={logoutAdmin}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      {/* MAIN CONTAINER (OFFSET RIGHT FOR SIDEBAR ON DESKTOP) */}
      <div className="admin-main-wrapper">
        {/* EXECUTIVE TOP COMMAND BAR */}
        <nav className="admin-command-bar">
          <div className="command-bar-left">
            <button
              type="button"
              className="admin-hamburger-btn"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              aria-label="Toggle Navigation"
            >
              ☰
            </button>
            <div className="command-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search offers by title, scope... (⌘K)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchSubmit(e);
                }}
              />
            </div>
          </div>

          <div className="command-bar-right">
            <button type="button" className="command-btn telemetry-btn">
              <span>🏷️</span> PROMOTIONS ENGINE
            </button>
            <button type="button" className="command-btn batch-btn" onClick={handleOpenCreateModal}>
              <span>+</span> CREATE NEW OFFER
            </button>

            <div className="admin-user-pill">
              <div className="admin-user-avatar">
                {admin?.name ? admin.name.charAt(0).toUpperCase() : "A"}
              </div>
              <div className="admin-user-details">
                <span className="admin-user-name">{admin?.name || "Master Perfumer"}</span>
                <span className="admin-user-role">Superuser / Admin</span>
              </div>
            </div>

            <button type="button" className="admin-top-logout" onClick={logoutAdmin}>
              LOGOUT
            </button>
          </div>
        </nav>

        {/* MAIN CONTENT AREA */}
        <main className="admin-main-container">
          {/* EXECUTIVE SUBHEADER & BREADCRUMB */}
          <div className="admin-executive-header">
            <div className="breadcrumb-line">
              <span>MAISON ATELIER</span> / <span>PROMOTIONS & CATALOGUE OFFERS</span>
            </div>
            <div className="admin-offers-header-row">
              <div className="header-titles">
                <h1 className="executive-title">Offer Management</h1>
                <p className="admin-page-subtitle">
                  Configure automatic catalogue discounts, category promotions, and variant-level pricing.
                </p>
              </div>
              <button
                type="button"
                className="fexa-btn-primary create-offer-btn header-action-btn"
                onClick={handleOpenCreateModal}
              >
                <span className="btn-icon">+</span> Create New Offer
              </button>
            </div>
          </div>

          {/* Toast Notification Banner */}
          {toast && (
            <div className={toast.type === "success" ? "admin-toast-success" : "admin-toast-error"}>
              <span>{toast.text}</span>
              <button type="button" onClick={() => setToast(null)} className="toast-dismiss-btn">
                ✕
              </button>
            </div>
          )}

          {/* 1. Statistics Cards */}
        <section className="offers-stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper purple">🏷️</div>
            <div className="stat-content">
              <span className="stat-label">Total Offers</span>
              <h3 className="stat-value">{stats.totalOffers}</h3>
              <span className="stat-sub">Configured in system</span>
            </div>
          </div>

          <div className="stat-card highlight">
            <div className="stat-icon-wrapper green">
              <span className="live-pulse-dot"></span>
              ✨
            </div>
            <div className="stat-content">
              <span className="stat-label">Active & Applying</span>
              <h3 className="stat-value">{stats.activeOffers}</h3>
              <span className="stat-sub">Live on storefront</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper amber">⏳</div>
            <div className="stat-content">
              <span className="stat-label">Upcoming / Expired</span>
              <h3 className="stat-value">
                {stats.upcomingOffers} / {stats.expiredOffers}
              </h3>
              <span className="stat-sub">Scheduled & concluded</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper lavender">💎</div>
            <div className="stat-content">
              <span className="stat-label">Total Offer Savings</span>
              <h3 className="stat-value">₹{Number(stats.totalOfferSavings || 0).toLocaleString("en-IN")}</h3>
              <span className="stat-sub">{stats.totalOrdersWithOffer || 0} orders benefited</span>
            </div>
          </div>
        </section>

        {/* 2. Control Bar: Search & Filters */}
        <section className="offers-control-bar">
          <form className="offer-search-box" onSubmit={handleSearchSubmit}>
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by offer name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="offer-search-input"
            />
            {search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={handleClearSearch}
                title="Clear Search"
              >
                ✕
              </button>
            )}
            <button type="submit" className="fexa-btn-secondary search-submit-btn">
              Search
            </button>
          </form>

          <div className="offer-filter-group">
            {/* Scope Filter */}
            <div className="filter-select-wrapper">
              <label htmlFor="scopeFilterSelect" className="filter-label">
                Scope:
              </label>
              <select
                id="scopeFilterSelect"
                value={scopeFilter}
                onChange={(e) => {
                  setScopeFilter(e.target.value);
                  setPage(1);
                }}
                className="fexa-select filter-select"
              >
                <option value="All">All Scopes</option>
                <option value="all">Catalogue Wide</option>
                <option value="category">Category Specific</option>
                <option value="product">Specific Product</option>
                <option value="products">Selected Products</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="filter-select-wrapper">
              <label htmlFor="statusFilterSelect" className="filter-label">
                Status:
              </label>
              <select
                id="statusFilterSelect"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="fexa-select filter-select"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Now</option>
                <option value="Inactive">Inactive</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
          </div>
        </section>

        {/* 3. Offers Table */}
        <section className="offers-table-card">
          {loading ? (
            <div className="table-loading-state">
              <div className="loading-spinner"></div>
              <p>Loading offers...</p>
            </div>
          ) : offers.length === 0 ? (
            <div className="table-empty-state">
              <span className="empty-icon">🏷️</span>
              <h3>No Offers Found</h3>
              <p>
                {appliedSearch || statusFilter !== "All" || scopeFilter !== "All"
                  ? "No offers match your current filter criteria."
                  : "Start by creating your first automatic product or category offer."}
              </p>
              <button
                type="button"
                className="fexa-btn-primary"
                onClick={handleOpenCreateModal}
                style={{ marginTop: "16px" }}
              >
                + Create Offer
              </button>
            </div>
          ) : (
            <div className="table-responsive-wrapper">
              <table className="fexa-admin-table offers-table">
                <thead>
                  <tr>
                    <th>Offer Name & Details</th>
                    <th>Scope & Targets</th>
                    <th>Discount</th>
                    <th>Validity Window</th>
                    <th>Live Status</th>
                    <th>Active</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((off) => (
                    <tr key={off._id} className={!off.isActive ? "row-inactive" : ""}>
                      {/* Name & Desc */}
                      <td className="cell-offer-name">
                        <strong className="offer-title">{off.name}</strong>
                        {off.description && <p className="offer-description">{off.description}</p>}
                        {off.minPurchaseAmount > 0 && (
                          <span className="offer-subtag">Min. ₹{off.minPurchaseAmount}</span>
                        )}
                      </td>

                      {/* Scope & Targets */}
                      <td>
                        <div className="scope-cell-content">
                          {renderScopeBadge(off)}
                          {off.scope === "product" && off.productId && (
                            <span className="target-preview-name">{off.productId.name}</span>
                          )}
                        </div>
                      </td>

                      {/* Discount */}
                      <td>
                        <div className="discount-cell-content">
                          <span className="discount-pill">
                            {off.discountType === "Percentage"
                              ? `${off.discountValue}% OFF`
                              : `₹${off.discountValue} OFF`}
                          </span>
                          {off.maxDiscount > 0 && (
                            <span className="max-cap-text">Max ₹{off.maxDiscount}</span>
                          )}
                        </div>
                      </td>

                      {/* Validity Dates */}
                      <td>
                        <div className="dates-cell-content">
                          <span className="date-start">
                            <strong>From:</strong> {formatDateDisplay(off.startDate)}
                          </span>
                          <span className="date-end">
                            <strong>To:</strong> {formatDateDisplay(off.endDate)}
                          </span>
                        </div>
                      </td>

                      {/* Live Status Badge */}
                      <td>{getOfferStatusTag(off)}</td>

                      {/* Quick Status Toggle Switch */}
                      <td>
                        <label className="fexa-switch" title="Toggle active status">
                          <input
                            type="checkbox"
                            checked={Boolean(off.isActive)}
                            onChange={() => handleToggleStatus(off)}
                          />
                          <span className="fexa-slider round"></span>
                        </label>
                      </td>

                      {/* Action Buttons */}
                      <td className="text-right">
                        <div className="action-buttons-group">
                          <button
                            type="button"
                            className="table-action-btn edit-btn"
                            onClick={() => handleOpenEditModal(off)}
                            title="Edit Offer"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="table-action-btn delete-btn"
                            onClick={() => handleOpenDeleteModal(off)}
                            title="Safe Archive Offer"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <AdminPagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalOffers}
            pageSize={pagination.limit || 10}
            itemName="offers"
            onPageChange={(newPage) => setPage(newPage)}
            loading={loading}
            variant="card-footer"
          />
        </section>
      </main>
    </div>

      {/* ========================================================
          CREATE / EDIT OFFER MODAL
         ======================================================== */}
      {(activeModal === "create" || activeModal === "edit") && (
        <div className="admin-modal-overlay" onClick={handleCloseModal}>
          <div
            className="admin-modal-card offer-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-icon">🏷️</span>
                <h2>{activeModal === "create" ? "Create New Automatic Offer" : "Edit Offer Configuration"}</h2>
              </div>
              <button type="button" className="modal-close-btn" onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveOffer} className="offer-form">
              <div className="modal-body-scrollable">
                {/* 1. Offer Name */}
                {/* 1. Offer Name */}
                <div className="form-group">
                  <label htmlFor="offerNameInput" className="form-label required">
                    Offer Name
                  </label>
                  <input
                    id="offerNameInput"
                    type="text"
                    placeholder="e.g. FEXA Men's Fragrance Festival"
                    value={formData.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    onBlur={() => handleFieldBlur("name")}
                    className={`form-input ${formErrors.name ? "input-error" : ""}`}
                    maxLength={120}
                  />
                  {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                </div>

                {/* 2. Offer Description */}
                <div className="form-group">
                  <label htmlFor="offerDescInput" className="form-label">
                    Short Description (Optional)
                  </label>
                  <textarea
                    id="offerDescInput"
                    rows="2"
                    placeholder="e.g. Enjoy special promotional savings on selected FEXA fragrances."
                    value={formData.description}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    onBlur={() => handleFieldBlur("description")}
                    className={`form-textarea ${formErrors.description ? "input-error" : ""}`}
                    maxLength={300}
                  ></textarea>
                  {formErrors.description && <span className="error-text">{formErrors.description}</span>}
                </div>

                {/* 3. Scope Selector (THE MOST IMPORTANT FEATURE) */}
                <div className="form-group scope-selection-section">
                  <label className="form-label required">Apply Offer To (Scope)</label>
                  <div className="scope-radio-grid">
                    <button
                      type="button"
                      className={`scope-pill-btn ${formData.scope === "all" ? "active" : ""}`}
                      onClick={() => handleScopeChange("all")}
                    >
                      <span className="scope-pill-icon">🌐</span>
                      <div className="scope-pill-info">
                        <strong>All Products</strong>
                        <span>Catalogue-wide</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`scope-pill-btn ${formData.scope === "category" ? "active" : ""}`}
                      onClick={() => handleScopeChange("category")}
                    >
                      <span className="scope-pill-icon">🗂️</span>
                      <div className="scope-pill-info">
                        <strong>Specific Category</strong>
                        <span>Men, Women, or Unisex</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`scope-pill-btn ${formData.scope === "product" ? "active" : ""}`}
                      onClick={() => handleScopeChange("product")}
                    >
                      <span className="scope-pill-icon">🎯</span>
                      <div className="scope-pill-info">
                        <strong>Specific Product</strong>
                        <span>One designated perfume</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`scope-pill-btn ${formData.scope === "products" ? "active" : ""}`}
                      onClick={() => handleScopeChange("products")}
                    >
                      <span className="scope-pill-icon">📦</span>
                      <div className="scope-pill-info">
                        <strong>Selected Products</strong>
                        <span>Multi-product curation</span>
                      </div>
                    </button>
                  </div>
                  {formErrors.scope && <span className="error-text">{formErrors.scope}</span>}
                </div>

                {/* 4. Dynamic Scope Controls */}
                {formData.scope === "all" && (
                  <div className="scope-details-card scope-all-card">
                    <span className="info-icon">💡</span>
                    <div className="scope-callout-text">
                      <strong>All Active Products Qualified:</strong> This automatic offer applies to every
                      purchasable fragrance across Men, Women, and Unisex collections. Products in inactive
                      categories remain strictly protected.
                    </div>
                  </div>
                )}

                {formData.scope === "category" && (
                  <div className="scope-details-card scope-category-card">
                    <label className="form-label required">Select Qualifying Category</label>
                    <div className="category-options-grid">
                      {["Men", "Women", "Unisex"].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={`category-select-pill ${formData.category === cat ? "active" : ""}`}
                          onClick={() => handleFieldChange("category", cat)}
                        >
                          <span className="cat-icon">
                            {cat === "Men" ? "🎩" : cat === "Women" ? "🌸" : "✨"}
                          </span>
                          <span className="cat-name">{cat} Collection</span>
                        </button>
                      ))}
                    </div>
                    {formErrors.category && <span className="error-text">{formErrors.category}</span>}
                  </div>
                )}

                {formData.scope === "product" && (
                  <div className="scope-details-card scope-product-card">
                    <label className="form-label required">Select Target Product</label>

                    {/* Selected product preview if any */}
                    {selectedProductDetails ? (
                      <div className="selected-product-item">
                        <div className="selected-thumb">
                          {selectedProductDetails.images && selectedProductDetails.images[0] ? (
                            <img
                              src={
                                selectedProductDetails.images[0].startsWith("http")
                                  ? selectedProductDetails.images[0]
                                  : `http://localhost:5000${selectedProductDetails.images[0]}`
                              }
                              alt={selectedProductDetails.name}
                            />
                          ) : (
                            <span className="placeholder-icon">⚗️</span>
                          )}
                        </div>
                        <div className="selected-meta">
                          <strong className="selected-title">{selectedProductDetails.name}</strong>
                          <span className="selected-sub">
                            {selectedProductDetails.brand || "FEXA"} • {selectedProductDetails.category} • From ₹
                            {selectedProductDetails.price}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="change-target-btn"
                          onClick={() => {
                            setSelectedProductDetails(null);
                            handleFieldChange("productId", null);
                          }}
                        >
                          Change Product
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="catalogue-search-bar">
                          <input
                            type="text"
                            placeholder="Type perfume name to search MongoDB catalogue..."
                            value={productSearchQuery}
                            onChange={(e) => setProductSearchQuery(e.target.value)}
                            className="form-input search-input"
                          />
                        </div>

                        <div className="catalogue-picker-list">
                          {productSearchLoading ? (
                            <div className="picker-loading">Searching catalogue...</div>
                          ) : productSearchResults.length === 0 ? (
                            <div className="picker-empty">No matching products found.</div>
                          ) : (
                            productSearchResults.map((prod) => (
                              <div
                                key={prod._id}
                                className="picker-item"
                                onClick={() => {
                                  setSelectedProductDetails(prod);
                                  handleFieldChange("productId", prod._id);
                                }}
                              >
                                <div className="picker-thumb">
                                  {prod.images && prod.images[0] ? (
                                    <img
                                      src={
                                        prod.images[0].startsWith("http")
                                          ? prod.images[0]
                                          : `http://localhost:5000${prod.images[0]}`
                                      }
                                      alt={prod.name}
                                    />
                                  ) : (
                                    <span>⚗️</span>
                                  )}
                                </div>
                                <div className="picker-meta">
                                  <strong>{prod.name}</strong>
                                  <span>
                                    {prod.category} • ₹{prod.price}
                                  </span>
                                </div>
                                <button type="button" className="picker-select-btn">
                                  Select
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                    {formErrors.productId && <span className="error-text">{formErrors.productId}</span>}
                  </div>
                )}

                {formData.scope === "products" && (
                  <div className="scope-details-card scope-multi-card">
                    <label className="form-label required">Select Included Products</label>

                    {/* Selected Chips List */}
                    {selectedProductsList.length > 0 && (
                      <div className="selected-chips-grid">
                        {selectedProductsList.map((prod) => (
                          <div key={prod._id} className="selected-product-chip">
                            <span className="chip-name">{prod.name}</span>
                            <span className="chip-cat">({prod.category})</span>
                            <button
                              type="button"
                              className="chip-remove-btn"
                              onClick={() => {
                                const nextList = selectedProductsList.filter((p) => p._id !== prod._id);
                                setSelectedProductsList(nextList);
                                handleFieldChange(
                                  "productIds",
                                  nextList.map((p) => p._id)
                                );
                              }}
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="catalogue-search-bar">
                      <input
                        type="text"
                        placeholder="Search more perfumes to add..."
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        className="form-input search-input"
                      />
                    </div>

                    <div className="catalogue-picker-list">
                      {productSearchLoading ? (
                        <div className="picker-loading">Searching catalogue...</div>
                      ) : productSearchResults.length === 0 ? (
                        <div className="picker-empty">No matching products found.</div>
                      ) : (
                        productSearchResults.map((prod) => {
                          const isAlreadySelected = selectedProductsList.some((p) => p._id === prod._id);
                          return (
                            <div
                              key={prod._id}
                              className={`picker-item ${isAlreadySelected ? "already-selected" : ""}`}
                              onClick={() => {
                                if (isAlreadySelected) {
                                  const nextList = selectedProductsList.filter((p) => p._id !== prod._id);
                                  setSelectedProductsList(nextList);
                                  handleFieldChange(
                                    "productIds",
                                    nextList.map((p) => p._id)
                                  );
                                } else {
                                  const nextList = [...selectedProductsList, prod];
                                  setSelectedProductsList(nextList);
                                  handleFieldChange(
                                    "productIds",
                                    nextList.map((p) => p._id)
                                  );
                                }
                              }}
                            >
                              <div className="picker-thumb">
                                {prod.images && prod.images[0] ? (
                                  <img
                                    src={
                                      prod.images[0].startsWith("http")
                                        ? prod.images[0]
                                        : `http://localhost:5000${prod.images[0]}`
                                    }
                                    alt={prod.name}
                                  />
                                ) : (
                                  <span>⚗️</span>
                                )}
                              </div>
                              <div className="picker-meta">
                                <strong>{prod.name}</strong>
                                <span>
                                  {prod.category} • ₹{prod.price}
                                </span>
                              </div>
                              <button
                                type="button"
                                className={`picker-select-btn ${isAlreadySelected ? "selected" : ""}`}
                              >
                                {isAlreadySelected ? "✓ Added" : "+ Add"}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {formErrors.productIds && <span className="error-text">{formErrors.productIds}</span>}
                  </div>
                )}

                {/* 5. Discount Type & Value */}
                <div className="form-row-2col">
                  <div className="form-group">
                    <label htmlFor="discountTypeSelect" className="form-label required">
                      Discount Type
                    </label>
                    <select
                      id="discountTypeSelect"
                      value={formData.discountType}
                      onChange={(e) => handleFieldChange("discountType", e.target.value)}
                      onBlur={() => handleFieldBlur("discountType")}
                      className={`fexa-select ${formErrors.discountType ? "input-error" : ""}`}
                    >
                      <option value="Percentage">Percentage Discount (%)</option>
                      <option value="Fixed">Fixed Amount Discount (₹)</option>
                    </select>
                    {formErrors.discountType && (
                      <span className="error-text">{formErrors.discountType}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="discountValueInput" className="form-label required">
                      Discount Value {formData.discountType === "Percentage" ? "(%)" : "(₹)"}
                    </label>
                    <input
                      id="discountValueInput"
                      type="number"
                      min="1"
                      step="any"
                      max={formData.discountType === "Percentage" ? "100" : undefined}
                      placeholder={formData.discountType === "Percentage" ? "e.g. 20" : "e.g. 500"}
                      value={formData.discountValue}
                      onChange={(e) => handleFieldChange("discountValue", e.target.value)}
                      onBlur={() => handleFieldBlur("discountValue")}
                      className={`form-input ${formErrors.discountValue ? "input-error" : ""}`}
                    />
                    {formErrors.discountValue && (
                      <span className="error-text">{formErrors.discountValue}</span>
                    )}
                  </div>
                </div>

                {/* 6. Optional Caps & Requirements */}
                <div className="form-row-2col">
                  <div className="form-group">
                    <label htmlFor="maxDiscountInput" className="form-label">
                      Maximum Discount Cap (₹ Optional)
                    </label>
                    <input
                      id="maxDiscountInput"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 1000 (leave blank for uncapped)"
                      value={formData.maxDiscount}
                      onChange={(e) => handleFieldChange("maxDiscount", e.target.value)}
                      onBlur={() => handleFieldBlur("maxDiscount")}
                      className={`form-input ${formErrors.maxDiscount ? "input-error" : ""}`}
                    />
                    {formErrors.maxDiscount && (
                      <span className="error-text">{formErrors.maxDiscount}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="minPurchaseInput" className="form-label">
                      Minimum Eligible Purchase (₹ Optional)
                    </label>
                    <input
                      id="minPurchaseInput"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 1500"
                      value={formData.minPurchaseAmount}
                      onChange={(e) => handleFieldChange("minPurchaseAmount", e.target.value)}
                      onBlur={() => handleFieldBlur("minPurchaseAmount")}
                      className={`form-input ${formErrors.minPurchaseAmount ? "input-error" : ""}`}
                    />
                    {formErrors.minPurchaseAmount && (
                      <span className="error-text">{formErrors.minPurchaseAmount}</span>
                    )}
                  </div>
                </div>

                {/* 7. Validity Dates */}
                <div className="form-row-2col">
                  <div className="form-group">
                    <label htmlFor="startDateInput" className="form-label required">
                      Start Date & Time
                    </label>
                    <input
                      id="startDateInput"
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => handleFieldChange("startDate", e.target.value)}
                      onBlur={() => handleFieldBlur("startDate")}
                      className={`form-input ${formErrors.startDate ? "input-error" : ""}`}
                    />
                    {formErrors.startDate && <span className="error-text">{formErrors.startDate}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="endDateInput" className="form-label required">
                      Expiration Date & Time
                    </label>
                    <input
                      id="endDateInput"
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => handleFieldChange("endDate", e.target.value)}
                      onBlur={() => handleFieldBlur("endDate")}
                      className={`form-input ${formErrors.endDate ? "input-error" : ""}`}
                    />
                    {formErrors.endDate && <span className="error-text">{formErrors.endDate}</span>}
                  </div>
                </div>

                {/* 8. Active Toggle & Status */}
                <div className="form-group toggle-active-group">
                  <label className="toggle-label-wrap">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.isActive)}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <span className="checkbox-text">
                      <strong>Offer is Active Immediately</strong>
                      <small>When unchecked, offer will be saved as Inactive and will not apply.</small>
                    </span>
                  </label>
                </div>

                {/* 9. Real-Time Offer Preview Card (Requirement 4) */}
                <div className="offer-preview-card">
                  <div className="preview-card-header">
                    <span className="preview-badge">LIVE OFFER PREVIEW</span>
                    <span className="preview-scope-tag">
                      {formData.scope === "all"
                        ? "All Products"
                        : formData.scope === "category"
                        ? `${formData.category} Collection`
                        : formData.scope === "product"
                        ? selectedProductDetails?.name || "Single Product"
                        : `${selectedProductsList.length} Selected Products`}
                    </span>
                  </div>

                  <div className="preview-card-body">
                    <h4 className="preview-offer-title">{formData.name || "Untitled Offer"}</h4>
                    <p className="preview-offer-discount">
                      {formData.discountType === "Percentage"
                        ? `${formData.discountValue || 0}% OFF`
                        : `₹${formData.discountValue || 0} OFF`}
                      {formData.maxDiscount > 0 && ` (Capped at ₹${formData.maxDiscount})`}
                    </p>

                    <div className="preview-sample-calculation">
                      <span className="calc-label">Representative Customer Price Impact:</span>
                      <div className="calc-row">
                        <span>Original Selling Price:</span>
                        <strong>₹{sampleBasePrice}</strong>
                      </div>
                      <div className="calc-row discount-row">
                        <span>Automatic Offer Discount:</span>
                        <strong className="text-green">-₹{simulatedDiscount}</strong>
                      </div>
                      <div className="calc-row final-row">
                        <span>Customer Offer Price:</span>
                        <strong className="text-purple">₹{sampleBasePrice - simulatedDiscount}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="modal-footer">
                <button
                  type="button"
                  className="fexa-btn-secondary"
                  onClick={handleCloseModal}
                  disabled={actionProcessing}
                >
                  Cancel
                </button>
                <button type="submit" className="fexa-btn-primary" disabled={actionProcessing}>
                  {actionProcessing ? (
                    <span className="btn-loading-content">
                      <span className="small-spinner"></span> Saving...
                    </span>
                  ) : activeModal === "create" ? (
                    "Publish Offer"
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          DELETE / SAFE ARCHIVE CONFIRMATION MODAL
         ======================================================== */}
      {activeModal === "delete" && modalOffer && (
        <div className="admin-modal-overlay" onClick={handleCloseModal}>
          <div
            className="admin-modal-card delete-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <h2>Archive Offer</h2>
              <button type="button" className="modal-close-btn" onClick={handleCloseModal}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-warning-icon">⚠️</div>
              <p className="delete-confirm-text">
                Are you sure you want to remove <strong>"{modalOffer.name}"</strong>?
              </p>
              <p className="delete-info-note">
                To protect historical accuracy and refund calculations, this offer will be safely archived. It
                will immediately cease applying to storefront prices, while past order snapshots will remain intact.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="fexa-btn-secondary"
                onClick={handleCloseModal}
                disabled={actionProcessing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="fexa-btn-danger"
                onClick={handleConfirmDelete}
                disabled={actionProcessing}
              >
                {actionProcessing ? "Archiving..." : "Yes, Archive Offer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminOffers;
