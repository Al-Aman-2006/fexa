import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminPagination from "../../components/admin/AdminPagination";
import "./AdminDashboard.css";
import "./AdminCoupons.css";

function AdminCoupons() {
  const { admin, logoutAdmin } = useAdminAuth();
  const location = useLocation();

  const [coupons, setCoupons] = useState([]);
  const [stats, setStats] = useState({
    totalCoupons: 0,
    activeCoupons: 0,
    expiredCoupons: 0,
    totalRedemptions: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalCoupons: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Sidebar state
  const [activeTab, setActiveTab] = useState("coupons");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modal State: null | "create" | "edit" | "delete"
  const [activeModal, setActiveModal] = useState(null);
  const [modalCoupon, setModalCoupon] = useState(null);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const defaultFormData = {
    code: "",
    name: "",
    description: "",
    discountType: "Percentage",
    discountPercentage: 20,
    minOrderAmount: 0,
    maxDiscount: "",
    startDate: "",
    expiryDate: "",
    isActive: true,
    usageLimit: "",
    perUserLimit: 1,
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

  // Fetch coupons from backend API
  const fetchCoupons = useCallback(async (targetPage = 1, targetSearch = "", targetStatus = "All") => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: targetPage,
        limit: 10,
      });

      if (targetSearch.trim()) {
        queryParams.set("search", targetSearch.trim());
      }

      if (targetStatus && targetStatus !== "All") {
        queryParams.set("status", targetStatus);
      }

      const response = await fetch(
        `http://localhost:5000/api/admin/coupons?${queryParams.toString()}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await response.json();
      if (response.ok && data.success) {
        setCoupons(data.coupons || []);
        setPagination(
          data.pagination || { page: 1, limit: 10, totalCoupons: 0, totalPages: 1 }
        );
        if (data.stats) {
          setStats(data.stats);
        }
        setAppliedSearch(targetSearch.trim());
      } else {
        setToast({
          type: "error",
          text: data.message || "Unable to fetch coupons list.",
        });
      }
    } catch (error) {
      console.error("Fetch admin coupons error:", error);
      setToast({
        type: "error",
        text: "Unable to connect to the server to load coupons.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons(page, appliedSearch, statusFilter);
  }, [fetchCoupons, page, appliedSearch, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchCoupons(1, search, statusFilter);
  };

  const handleClearSearch = () => {
    setSearch("");
    setPage(1);
    fetchCoupons(1, "", statusFilter);
  };

  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
    fetchCoupons(1, appliedSearch, newStatus);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPage(newPage);
    }
  };

  // Open Create Modal with default dates
  const openCreateModal = () => {
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

    setFormData({
      ...defaultFormData,
      startDate: toDateTimeLocal(now),
      expiryDate: toDateTimeLocal(future),
    });
    setFormErrors({});
    setModalCoupon(null);
    setActiveModal("create");
  };

  // Open Edit Modal
  const openEditModal = (coupon) => {
    setFormData({
      code: coupon.code,
      name: coupon.name || "",
      description: coupon.description || "",
      discountType: coupon.discountType || "Percentage",
      discountPercentage: coupon.discountPercentage,
      minOrderAmount: coupon.minOrderAmount || 0,
      maxDiscount: coupon.maxDiscount !== null && coupon.maxDiscount !== undefined ? coupon.maxDiscount : "",
      startDate: toDateTimeLocal(coupon.startDate),
      expiryDate: toDateTimeLocal(coupon.expiryDate),
      isActive: coupon.isActive,
      usageLimit: coupon.usageLimit !== null && coupon.usageLimit !== undefined ? coupon.usageLimit : "",
      perUserLimit: coupon.perUserLimit || 1,
    });
    setFormErrors({});
    setModalCoupon(coupon);
    setActiveModal("edit");
  };

  // Open Delete / Archive Confirmation
  const openDeleteModal = (coupon) => {
    setModalCoupon(coupon);
    setActiveModal("delete");
  };

  const closeModal = () => {
    if (actionProcessing) return;
    setActiveModal(null);
    setModalCoupon(null);
    setFormErrors({});
  };

  // Client Validation for Form
  const validateForm = () => {
    const errors = {};

    const code = (formData.code || "").trim().toUpperCase();
    if (!code) {
      errors.code = "Coupon code is required.";
    } else if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
      errors.code = "Code must be 3-30 characters (letters, numbers, hyphens, underscores).";
    }

    const pct = Number(formData.discountPercentage);
    if (formData.discountPercentage === "" || isNaN(pct)) {
      errors.discountPercentage = "Discount percentage is required.";
    } else if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
      errors.discountPercentage = "Discount must be between 1% and 100%.";
    }

    const minOrder = Number(formData.minOrderAmount);
    if (isNaN(minOrder) || minOrder < 0) {
      errors.minOrderAmount = "Minimum order cannot be negative.";
    }

    if (formData.maxDiscount !== "" && formData.maxDiscount !== null) {
      const maxD = Number(formData.maxDiscount);
      if (isNaN(maxD) || maxD <= 0) {
        errors.maxDiscount = "Maximum discount must be a positive number.";
      }
    }

    if (!formData.startDate) {
      errors.startDate = "Start date and time is required.";
    }
    if (!formData.expiryDate) {
      errors.expiryDate = "Expiry date and time is required.";
    }

    if (formData.startDate && formData.expiryDate) {
      const s = new Date(formData.startDate);
      const e = new Date(formData.expiryDate);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        errors.expiryDate = "Invalid date format.";
      } else if (s.getTime() >= e.getTime()) {
        errors.expiryDate = "Expiry date must be after the start date.";
      }
    }

    if (formData.usageLimit !== "" && formData.usageLimit !== null) {
      const uLimit = parseInt(formData.usageLimit, 10);
      if (isNaN(uLimit) || uLimit < 1) {
        errors.usageLimit = "Usage limit must be at least 1.";
      }
    }

    const puLimit = parseInt(formData.perUserLimit, 10);
    if (isNaN(puLimit) || puLimit < 1) {
      errors.perUserLimit = "Per-user limit must be at least 1.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Create or Edit Form
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setActionProcessing(true);
      setToast(null);

      const endpoint =
        activeModal === "edit"
          ? `http://localhost:5000/api/admin/coupons/${modalCoupon._id}`
          : "http://localhost:5000/api/admin/coupons";
      const method = activeModal === "edit" ? "PUT" : "POST";

      const payload = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        discountType: "Percentage",
        discountPercentage: Number(formData.discountPercentage),
        minOrderAmount: Number(formData.minOrderAmount) || 0,
        maxDiscount:
          formData.maxDiscount !== "" && formData.maxDiscount !== null
            ? Number(formData.maxDiscount)
            : null,
        startDate: new Date(formData.startDate).toISOString(),
        expiryDate: new Date(formData.expiryDate).toISOString(),
        isActive: Boolean(formData.isActive),
        usageLimit:
          formData.usageLimit !== "" && formData.usageLimit !== null
            ? parseInt(formData.usageLimit, 10)
            : null,
        perUserLimit: parseInt(formData.perUserLimit, 10) || 1,
      };

      const response = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setToast({
          type: "success",
          text: data.message || `Coupon ${activeModal === "edit" ? "updated" : "created"} successfully.`,
        });
        closeModal();
        fetchCoupons(page, appliedSearch, statusFilter);
      } else {
        setToast({
          type: "error",
          text: data.message || "Operation failed. Please review your input.",
        });
        if (data.message && data.message.toLowerCase().includes("code")) {
          setFormErrors((prev) => ({ ...prev, code: data.message }));
        }
      }
    } catch (error) {
      console.error("Coupon form submit error:", error);
      setToast({
        type: "error",
        text: "Unable to connect to the server.",
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Toggle Active / Inactive
  const handleToggleStatus = async (coupon) => {
    try {
      setActionProcessing(true);
      setToast(null);

      const response = await fetch(
        `http://localhost:5000/api/admin/coupons/${coupon._id}/status`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await response.json();
      if (response.ok && data.success) {
        setToast({
          type: "success",
          text: data.message || `Coupon status updated.`,
        });
        fetchCoupons(page, appliedSearch, statusFilter);
      } else {
        setToast({
          type: "error",
          text: data.message || "Failed to update status.",
        });
      }
    } catch (error) {
      console.error("Toggle status error:", error);
      setToast({
        type: "error",
        text: "Unable to connect to server.",
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Confirm Delete / Archive
  const handleConfirmDelete = async () => {
    if (!modalCoupon) return;
    try {
      setActionProcessing(true);
      setToast(null);

      const response = await fetch(
        `http://localhost:5000/api/admin/coupons/${modalCoupon._id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await response.json();
      if (response.ok && data.success) {
        setToast({
          type: "success",
          text: data.message || `Coupon archived successfully.`,
        });
        closeModal();
        const nextPage = coupons.length === 1 && page > 1 ? page - 1 : page;
        if (nextPage !== page) {
          setPage(nextPage);
        }
        fetchCoupons(nextPage, appliedSearch, statusFilter);
      } else {
        setToast({
          type: "error",
          text: data.message || "Failed to archive coupon.",
        });
        closeModal();
      }
    } catch (error) {
      console.error("Delete coupon error:", error);
      setToast({
        type: "error",
        text: "Unable to connect to server.",
      });
      closeModal();
    } finally {
      setActionProcessing(false);
    }
  };

  const formatPrice = (val) => {
    if (val === undefined || val === null) return "₹0";
    return `₹${Number(val).toLocaleString("en-IN")}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getValidityStatus = (coupon) => {
    const now = new Date().getTime();
    const start = new Date(coupon.startDate).getTime();
    const expiry = new Date(coupon.expiryDate).getTime();

    if (now < start) {
      return { label: "Upcoming", class: "upcoming" };
    }
    if (now > expiry) {
      return { label: "Expired", class: "expired" };
    }
    return { label: "Active", class: "active" };
  };

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

      {/* MAIN CONTAINER */}
      <div className="admin-main-wrapper">
        {/* EXECUTIVE TOP COMMAND BAR */}
        <nav className="admin-command-bar">
          <div className="command-bar-left">
            <button
              className="admin-hamburger-btn"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            >
              ☰
            </button>
            <div className="command-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search promo codes, titles... (⌘K)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchSubmit(e);
                }}
              />
            </div>
          </div>

          <div className="command-bar-right">
            <button className="command-btn telemetry-btn">
              <span>🎟️</span> PROMOTIONS ENGINE
            </button>
            <button className="command-btn batch-btn" onClick={openCreateModal}>
              <span>+</span> NEW PRIVILEGE CODE
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

            <button className="admin-top-logout" onClick={logoutAdmin}>
              LOGOUT
            </button>
          </div>
        </nav>

        {/* MAIN CONTENT AREA */}
        <main className="admin-main-container">
          {/* EXECUTIVE SUBHEADER & BREADCRUMB */}
          <div className="admin-executive-header">
            <div className="breadcrumb-line">
              <span>MAISON ATELIER</span> / <span>PROMOTIONS & PRIVILEGE CODES</span>
            </div>
            <h1 className="executive-title">Coupon & Offer Management</h1>
            <div className="sync-badge">
              <span className="sync-dot"></span> STRICT SINGLE-COUPON POLICY ENFORCED
            </div>
          </div>

          {/* TOAST NOTIFICATION */}
          {toast && (
            <div className={toast.type === "success" ? "admin-toast-success" : "admin-toast-error"}>
              {toast.text}
            </div>
          )}

          {/* QUICK STATS */}
          <section className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="admin-stat-label">TOTAL PROMO CODES</span>
              <span className="admin-stat-value">{stats.totalCoupons}</span>
            </div>
            <div className="admin-stat-card active">
              <span className="admin-stat-label">ACTIVE CAMPAIGNS</span>
              <span className="admin-stat-value">{stats.activeCoupons}</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-label">TOTAL REDEMPTIONS</span>
              <span className="admin-stat-value">{stats.totalRedemptions}</span>
            </div>
            <div className="admin-stat-card blocked">
              <span className="admin-stat-label">EXPIRED CODES</span>
              <span className="admin-stat-value">{stats.expiredCoupons}</span>
            </div>
          </section>

          {/* SECTION HEADER & CONTROLS */}
          <div className="admin-section-header">
            <div className="admin-section-title">
              <h2>Coupon Directory</h2>
              <p>Configure percentage discounts, minimum cart subtotals, caps, and redemption limits.</p>
            </div>

            <div className="admin-controls-group">
              <button className="admin-create-user-btn" onClick={openCreateModal}>
                <span>+</span> ADD NEW COUPON
              </button>

              <select
                className="admin-filter-select"
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
                <option value="Expired">Expired Only</option>
              </select>

              <form className="admin-search-form" onSubmit={handleSearchSubmit}>
                <div className="admin-search-wrapper">
                  <input
                    type="text"
                    placeholder="Search by code or offer title..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="admin-search-input"
                  />
                </div>
                <button type="submit" className="admin-search-btn">
                  SEARCH
                </button>
                {(search || appliedSearch) && (
                  <button
                    type="button"
                    className="admin-clear-btn"
                    onClick={handleClearSearch}
                  >
                    ✕ Clear
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* COUPONS TABLE CARD */}
          <div className="admin-table-card">
            <div className="admin-table-scroll-wrapper">
              <table className="admin-coupons-table">
              <thead>
                <tr>
                  <th>COUPON CODE</th>
                  <th>OFFER TITLE & DETAILS</th>
                  <th>DISCOUNT VALUE</th>
                  <th>VALIDITY WINDOW</th>
                  <th>REDEMPTIONS</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="admin-loading-row">
                      Loading atelier promo codes...
                    </td>
                  </tr>
                ) : coupons.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="admin-empty-row">
                      {appliedSearch
                        ? `No coupons found matching "${appliedSearch}"`
                        : "No coupons currently created in atelier directory."}
                    </td>
                  </tr>
                ) : (
                  coupons.map((c) => {
                    const validity = getValidityStatus(c);
                    const isFullyExhausted =
                      c.usageLimit !== null && (c.usedCount || 0) >= c.usageLimit;

                    return (
                      <tr key={c._id}>
                        <td>
                          <span className="coupon-code-badge">
                            <span className="coupon-code-icon">🎟️</span>
                            <span>{c.code}</span>
                          </span>
                        </td>
                        <td>
                          <div className="coupon-name-cell">
                            <span className="coupon-title-text">{c.name || "Special Privilege"}</span>
                            {c.description && <span className="coupon-desc-sub">{c.description}</span>}
                          </div>
                        </td>
                        <td>
                          <span className="discount-pill">
                            <span>🏷️</span>
                            <span>{c.discountPercentage}% OFF</span>
                          </span>
                          <span className="discount-limits-sub">
                            Min: {c.minOrderAmount > 0 ? formatPrice(c.minOrderAmount) : "None"}
                            {c.maxDiscount ? ` • Max: ${formatPrice(c.maxDiscount)}` : ""}
                          </span>
                        </td>
                        <td>
                          <div className="validity-cell">
                            <span className="validity-dates">
                              {formatDate(c.startDate)} → {formatDate(c.expiryDate)}
                            </span>
                            <span className={`validity-status-tag ${validity.class}`}>
                              ● {validity.label}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="usage-cell">
                            <div className="usage-count-bar-wrapper">
                              <span className="usage-text">
                                {c.usedCount || 0}{" "}
                                <span className="usage-limit-total">
                                  / {c.usageLimit ? c.usageLimit : "∞"}
                                </span>
                              </span>
                            </div>
                            <span className="usage-per-user-sub">
                              Limit: {c.perUserLimit || 1} use/patron
                            </span>
                          </div>
                        </td>
                        <td>
                          {isFullyExhausted ? (
                            <span className="status-badge blocked">● Exhausted</span>
                          ) : !c.isActive ? (
                            <span className="status-badge blocked">● Inactive</span>
                          ) : validity.class === "expired" ? (
                            <span className="status-badge blocked" style={{ opacity: 0.7 }}>● Expired</span>
                          ) : (
                            <span className="status-badge active">● Active</span>
                          )}
                        </td>
                        <td>
                          <div className="admin-actions-cell">
                            <button
                              className="action-edit-btn"
                              onClick={() => openEditModal(c)}
                              title="Edit coupon configuration"
                            >
                              EDIT
                            </button>

                            <button
                              className={c.isActive ? "action-block-btn" : "action-unblock-btn"}
                              onClick={() => handleToggleStatus(c)}
                              title={c.isActive ? "Deactivate coupon" : "Activate coupon"}
                            >
                              {c.isActive ? "DEACTIVATE" : "ACTIVATE"}
                            </button>

                            <button
                              className="action-delete-btn"
                              onClick={() => openDeleteModal(c)}
                              title="Archive coupon"
                            >
                              DELETE
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>

            {/* PAGINATION CONTROLS */}
            {!loading && (
              <AdminPagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalCoupons}
                pageSize={pagination.limit || 10}
                itemName="coupons"
                onPageChange={handlePageChange}
                loading={loading}
                variant="card-footer"
              />
            )}
          </div>
        </main>
      </div>

      {/* CREATE & EDIT COUPON MODAL */}
      {(activeModal === "create" || activeModal === "edit") && (
        <div className="coupon-modal-overlay" onClick={closeModal}>
          <div className="coupon-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="coupon-modal-header">
              <h3>
                <span>🎟️</span>
                <span>{activeModal === "edit" ? "Edit Coupon Privilege" : "Create New Coupon"}</span>
              </h3>
              <button type="button" className="coupon-modal-close-btn" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm}>
              <div className="coupon-modal-body">
                <div className="coupon-form-grid-2">
                  {/* Coupon Code */}
                  <div className="coupon-form-group">
                    <label>COUPON CODE *</label>
                    <input
                      type="text"
                      placeholder="e.g. FEXA20, WELCOME15"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          code: e.target.value.toUpperCase().replace(/\s+/g, ""),
                        }))
                      }
                      required
                    />
                    {formErrors.code ? (
                      <span className="coupon-field-error">{formErrors.code}</span>
                    ) : (
                      <span className="coupon-field-hint">Normalized to uppercase automatically.</span>
                    )}
                  </div>

                  {/* Percentage Discount */}
                  <div className="coupon-form-group">
                    <label>PERCENTAGE DISCOUNT (1 - 100%) *</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      placeholder="e.g. 20"
                      value={formData.discountPercentage}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          discountPercentage: e.target.value,
                        }))
                      }
                      required
                    />
                    {formErrors.discountPercentage ? (
                      <span className="coupon-field-error">{formErrors.discountPercentage}</span>
                    ) : (
                      <span className="coupon-field-hint">Percent deducted from merchandise subtotal.</span>
                    )}
                  </div>

                  {/* Coupon Name */}
                  <div className="coupon-form-group full">
                    <label>OFFER TITLE / NAME (OPTIONAL)</label>
                    <input
                      type="text"
                      placeholder="e.g. FEXA Signature Privilege"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>

                  {/* Description */}
                  <div className="coupon-form-group full">
                    <label>OFFER DESCRIPTION</label>
                    <textarea
                      placeholder="e.g. Enjoy 20% off your curated artisanal perfume selection."
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, description: e.target.value }))
                      }
                      rows={2}
                    />
                  </div>

                  {/* Minimum Order Amount */}
                  <div className="coupon-form-group">
                    <label>MINIMUM ORDER SUBTOTAL (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      placeholder="0 for no minimum"
                      value={formData.minOrderAmount}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          minOrderAmount: e.target.value,
                        }))
                      }
                    />
                    {formErrors.minOrderAmount && (
                      <span className="coupon-field-error">{formErrors.minOrderAmount}</span>
                    )}
                  </div>

                  {/* Maximum Discount Cap */}
                  <div className="coupon-form-group">
                    <label>MAXIMUM DISCOUNT CAP (₹, OPTIONAL)</label>
                    <input
                      type="number"
                      min="1"
                      step="100"
                      placeholder="Leave blank for no cap"
                      value={formData.maxDiscount}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, maxDiscount: e.target.value }))
                      }
                    />
                    {formErrors.maxDiscount && (
                      <span className="coupon-field-error">{formErrors.maxDiscount}</span>
                    )}
                  </div>

                  {/* Start Date */}
                  <div className="coupon-form-group">
                    <label>START DATE & TIME *</label>
                    <input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, startDate: e.target.value }))
                      }
                      required
                    />
                    {formErrors.startDate && (
                      <span className="coupon-field-error">{formErrors.startDate}</span>
                    )}
                  </div>

                  {/* Expiry Date */}
                  <div className="coupon-form-group">
                    <label>EXPIRY DATE & TIME *</label>
                    <input
                      type="datetime-local"
                      value={formData.expiryDate}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, expiryDate: e.target.value }))
                      }
                      required
                    />
                    {formErrors.expiryDate && (
                      <span className="coupon-field-error">{formErrors.expiryDate}</span>
                    )}
                  </div>

                  {/* Total Usage Limit */}
                  <div className="coupon-form-group">
                    <label>TOTAL REDEMPTIONS LIMIT (OPTIONAL)</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Leave blank for unlimited"
                      value={formData.usageLimit}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, usageLimit: e.target.value }))
                      }
                    />
                    {formErrors.usageLimit && (
                      <span className="coupon-field-error">{formErrors.usageLimit}</span>
                    )}
                  </div>

                  {/* Per User Limit */}
                  <div className="coupon-form-group">
                    <label>PER-PATRON USAGE LIMIT *</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.perUserLimit}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, perUserLimit: e.target.value }))
                      }
                      required
                    />
                    {formErrors.perUserLimit && (
                      <span className="coupon-field-error">{formErrors.perUserLimit}</span>
                    )}
                  </div>

                  {/* Active Toggle */}
                  <div className="coupon-form-group full">
                    <label className="coupon-toggle-row">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                        }
                      />
                      <span className="coupon-toggle-label">
                        Activate this coupon immediately for customer checkout
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="coupon-modal-footer">
                <button
                  type="button"
                  className="coupon-modal-cancel-btn"
                  onClick={closeModal}
                  disabled={actionProcessing}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="coupon-modal-submit-btn"
                  disabled={actionProcessing}
                >
                  {actionProcessing
                    ? "COMMITTING TO REPOSITORY..."
                    : activeModal === "edit"
                    ? "SAVE CHANGES →"
                    : "CREATE COUPON →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE / ARCHIVE MODAL */}
      {activeModal === "delete" && modalCoupon && (
        <div className="coupon-modal-overlay" onClick={closeModal}>
          <div className="coupon-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="coupon-modal-header">
              <h3>
                <span>⚠️</span>
                <span>Archive Coupon Confirmation</span>
              </h3>
              <button type="button" className="coupon-modal-close-btn" onClick={closeModal}>
                ✕
              </button>
            </div>

            <div className="coupon-modal-body">
              <div className="coupon-confirm-delete-box">
                <div className="delete-icon">🗃️</div>
                <h4>Archive Coupon "{modalCoupon.code}"?</h4>
                <p>
                  This coupon will be deactivated and marked as archived. Customers will no longer be
                  able to claim or apply this coupon. Historical orders referencing this coupon will
                  retain their immutable discount snapshot.
                </p>
              </div>
            </div>

            <div className="coupon-modal-footer">
              <button
                type="button"
                className="coupon-modal-cancel-btn"
                onClick={closeModal}
                disabled={actionProcessing}
              >
                KEEP ACTIVE
              </button>
              <button
                type="button"
                className="coupon-modal-submit-btn"
                style={{ background: "linear-gradient(135deg, #c94b63, #8c253b)" }}
                onClick={handleConfirmDelete}
                disabled={actionProcessing}
              >
                {actionProcessing ? "ARCHIVING..." : "YES, ARCHIVE COUPON →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCoupons;
