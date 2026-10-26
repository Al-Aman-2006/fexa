import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminPagination from "../../components/admin/AdminPagination";
import "./AdminDashboard.css";
import "./AdminReviews.css";

function AdminReviews() {
  const { admin, logoutAdmin } = useAdminAuth();
  const location = useLocation();

  const [reviews, setReviews] = useState([]);
  const [kpis, setKpis] = useState({
    totalReviews: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    averageRating: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [sortOption, setSortOption] = useState("newest");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Sidebar state
  const [activeTab, setActiveTab] = useState("reviews");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modal states: null | "details" | "delete"
  const [activeModal, setActiveModal] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);
  const [actionProcessing, setActionProcessing] = useState(false);

  // Toast Helper
  const showToast = (type, title, text) => {
    setToast({ type, title, text });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Helper image URL resolver
  const getProductImage = (product) => {
    if (!product || !product.images || product.images.length === 0) {
      return null;
    }
    const raw = product.images[0];
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return raw;
    }
    const clean = raw.startsWith("/") ? raw : `/${raw}`;
    return `http://localhost:5000${clean}`;
  };

  // Helper date formatter
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Fetch reviews from backend API
  const fetchReviews = useCallback(
    async (
      targetPage = 1,
      targetSearch = "",
      targetStatus = "All",
      targetRating = "All",
      targetSort = "newest"
    ) => {
      try {
        setLoading(true);
        const queryParams = new URLSearchParams({
          page: targetPage,
          limit: 10,
          sort: targetSort,
        });

        if (targetSearch.trim()) {
          queryParams.set("search", targetSearch.trim());
        }

        if (targetStatus && targetStatus !== "All") {
          queryParams.set("status", targetStatus.toLowerCase());
        }

        if (targetRating && targetRating !== "All") {
          queryParams.set("rating", targetRating);
        }

        const response = await fetch(
          `http://localhost:5000/api/admin/reviews?${queryParams.toString()}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        const data = await response.json();

        if (response.ok && data.success) {
          setReviews(data.reviews || []);
          if (data.kpis) {
            setKpis(data.kpis);
          }
          if (data.pagination) {
            setPagination(data.pagination);
          }
        } else {
          showToast(
            "error",
            "Error",
            data.message || "Failed to load reviews."
          );
        }
      } catch (err) {
        console.error("Fetch reviews error:", err);
        showToast(
          "error",
          "Network Error",
          "Unable to connect to the FEXA review service."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Trigger fetch when filter states change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReviews(page, search, statusFilter, ratingFilter, sortOption);
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchReviews, page, search, statusFilter, ratingFilter, sortOption]);

  // Handle Review Status Toggle (Approve / Reject / Pending)
  const handleUpdateStatus = async (reviewId, newStatus) => {
    try {
      setActionProcessing(true);
      const res = await fetch(
        `http://localhost:5000/api/admin/reviews/${reviewId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: newStatus }),
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          "success",
          "Status Updated",
          `Review marked as ${newStatus.toUpperCase()}.`
        );
        if (selectedReview && selectedReview._id === reviewId) {
          setSelectedReview((prev) => ({ ...prev, status: newStatus }));
        }
        fetchReviews(page, search, statusFilter, ratingFilter, sortOption);
      } else {
        showToast("error", "Action Failed", data.message || "Unable to update status.");
      }
    } catch (err) {
      console.error("Update status error:", err);
      showToast("error", "Error", "Failed to update review status.");
    } finally {
      setActionProcessing(false);
    }
  };

  // Handle Delete Review
  const handleDeleteReview = async () => {
    if (!selectedReview) return;
    try {
      setActionProcessing(true);
      const res = await fetch(
        `http://localhost:5000/api/admin/reviews/${selectedReview._id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        showToast("success", "Deleted", "Review permanently removed.");
        setActiveModal(null);
        setSelectedReview(null);
        fetchReviews(page, search, statusFilter, ratingFilter, sortOption);
      } else {
        showToast("error", "Error", data.message || "Failed to delete review.");
      }
    } catch (err) {
      console.error("Delete review error:", err);
      showToast("error", "Error", "Failed to communicate with server.");
    } finally {
      setActionProcessing(false);
    }
  };

  // Render Star Display Helper
  const renderStars = (rating) => {
    const full = Math.min(5, Math.max(1, Math.round(rating)));
    return (
      <div className="admin-stars-row" title={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`admin-star ${star <= full ? "gold" : "dim"}`}
          >
            ★
          </span>
        ))}
        <span className="admin-star-num">{rating}.0</span>
      </div>
    );
  };

  return (
    <div className="admin-dashboard-page">
      {/* SIDEBAR NAVIGATION */}
      <AdminSidebar
        activeTab="reviews"
        setActiveTab={setActiveTab}
        onLogout={logoutAdmin}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      {/* MAIN WRAPPER */}
      <div className="admin-main-wrapper">
        {/* EXECUTIVE TOP COMMAND BAR */}
        <nav className="admin-command-bar">
          <div className="command-bar-left">
            <button
              className="admin-hamburger-btn"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              aria-label="Toggle navigation menu"
            >
              ☰
            </button>
            <div className="command-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search reviews by fragrance, patron, email... (⌘K)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="command-bar-right">
            <button
              className="command-btn telemetry-btn"
              onClick={() => fetchReviews(page, search, statusFilter, ratingFilter, sortOption)}
              disabled={loading}
              title="Refresh reviews data"
            >
              <span>{loading ? "⟳" : "⭐"}</span> REVIEWS CURATION
            </button>

            <div className="admin-user-pill">
              <div className="admin-user-avatar">
                {admin?.name ? admin.name.charAt(0).toUpperCase() : "A"}
              </div>
              <div className="admin-user-details">
                <span className="admin-user-name">{admin?.name || "Master Perfumer"}</span>
                <span className="admin-user-role">Superuser / Curator</span>
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
              <span>MAISON ATELIER</span> / <span>CUSTOMER FEEDBACK</span> / <span>PRODUCT REVIEWS</span>
            </div>
            <h1 className="executive-title">Review Moderation Atelier</h1>
            <div className="sync-badge">
              <span className="sync-dot"></span> LIVE ATELIER CURATION ENGINE
            </div>
          </div>

        {/* TOAST ALERTS */}
        {toast && (
          <div className={`admin-toast-banner ${toast.type}`}>
            <span className="toast-icon">
              {toast.type === "success" ? "✓" : "⚠"}
            </span>
            <div className="toast-body">
              <strong>{toast.title}</strong>
              <p>{toast.text}</p>
            </div>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => setToast(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* KPI METRICS CARDS */}
        <section className="admin-kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon-box gold">⭐</div>
            <div className="kpi-info-box">
              <span className="kpi-label">TOTAL REVIEWS</span>
              <h3 className="kpi-value">{kpis.totalReviews.toLocaleString()}</h3>
              <span className="kpi-subtext">All-time customer reviews</span>
            </div>
          </div>

          <div className="kpi-card highlight-pending">
            <div className="kpi-icon-box amber">⏳</div>
            <div className="kpi-info-box">
              <span className="kpi-label">PENDING MODERATION</span>
              <h3 className="kpi-value text-amber">{kpis.pendingCount.toLocaleString()}</h3>
              <span className="kpi-subtext">Requires curator approval</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-box emerald">✓</div>
            <div className="kpi-info-box">
              <span className="kpi-label">APPROVED & PUBLIC</span>
              <h3 className="kpi-value text-emerald">{kpis.approvedCount.toLocaleString()}</h3>
              <span className="kpi-subtext">Live on product details</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-box rose">✗</div>
            <div className="kpi-info-box">
              <span className="kpi-label">REJECTED / HIDDEN</span>
              <h3 className="kpi-value text-rose">{kpis.rejectedCount.toLocaleString()}</h3>
              <span className="kpi-subtext">Suppressed from public storefront</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-box purple">⚜️</div>
            <div className="kpi-info-box">
              <span className="kpi-label">AVERAGE STORE RATING</span>
              <h3 className="kpi-value text-gold">{kpis.averageRating.toFixed(1)} / 5.0</h3>
              <span className="kpi-subtext">Calculated from approved reviews</span>
            </div>
          </div>
        </section>

        {/* TOOLBAR: SEARCH, STATUS TABS, RATING FILTER, SORT */}
        <section className="admin-reviews-toolbar-card">
          <div className="toolbar-top-row">
            {/* STATUS FILTER TABS */}
            <div className="reviews-status-tabs" role="tablist">
              {[
                { id: "All", label: "All Reviews", count: kpis.totalReviews },
                { id: "pending", label: "Pending", count: kpis.pendingCount },
                { id: "approved", label: "Approved", count: kpis.approvedCount },
                { id: "rejected", label: "Rejected", count: kpis.rejectedCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className={`status-tab-btn ${statusFilter.toLowerCase() === tab.id.toLowerCase() ? "active" : ""}`}
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setPage(1);
                  }}
                >
                  <span>{tab.label}</span>
                  <span className="status-tab-badge">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* SEARCH INPUT */}
            <div className="toolbar-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by customer, email, fragrance, or keyword..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="toolbar-search-input"
              />
              {search && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="toolbar-bottom-row">
            {/* RATING FILTER */}
            <div className="toolbar-filter-group">
              <label htmlFor="rating-filter-select">Filter by Rating:</label>
              <select
                id="rating-filter-select"
                value={ratingFilter}
                onChange={(e) => {
                  setRatingFilter(e.target.value);
                  setPage(1);
                }}
                className="toolbar-select"
              >
                <option value="All">All Stars (1 - 5)</option>
                <option value="5">★★★★★ (5 Stars)</option>
                <option value="4">★★★★☆ (4 Stars)</option>
                <option value="3">★★★☆☆ (3 Stars)</option>
                <option value="2">★★☆☆☆ (2 Stars)</option>
                <option value="1">★☆☆☆☆ (1 Star)</option>
              </select>
            </div>

            {/* SORT SELECT */}
            <div className="toolbar-filter-group">
              <label htmlFor="sort-filter-select">Sort by:</label>
              <select
                id="sort-filter-select"
                value={sortOption}
                onChange={(e) => {
                  setSortOption(e.target.value);
                  setPage(1);
                }}
                className="toolbar-select"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest">Highest Rating</option>
                <option value="lowest">Lowest Rating</option>
              </select>
            </div>
          </div>
        </section>

        {/* REVIEWS TABLE SECTION */}
        <section className="admin-table-card">
          <div className="table-header-info">
            <span className="table-results-count">
              Showing {reviews.length} of {pagination.total} reviews
            </span>
            {statusFilter !== "All" && (
              <span className="table-active-filter-tag">
                Filter: <strong>{statusFilter.toUpperCase()}</strong>
              </span>
            )}
          </div>

          <div className="table-responsive-wrapper">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: "24%" }}>FRAGRANCE</th>
                  <th scope="col" style={{ width: "20%" }}>CUSTOMER</th>
                  <th scope="col" style={{ width: "14%" }}>RATING</th>
                  <th scope="col" style={{ width: "24%" }}>COMMENT</th>
                  <th scope="col" style={{ width: "10%" }}>STATUS</th>
                  <th scope="col" style={{ width: "8%", textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="6" className="table-empty-cell loading">
                      <div className="table-spinner"></div>
                      <span>Querying customer review records...</span>
                    </td>
                  </tr>
                )}

                {!loading && reviews.length === 0 && (
                  <tr>
                    <td colSpan="6" className="table-empty-cell">
                      <div className="empty-state-icon">⭐</div>
                      <h4>No Reviews Found</h4>
                      <p>
                        {search || statusFilter !== "All" || ratingFilter !== "All"
                          ? "No reviews match your current filters. Try resetting search or status."
                          : "No customer reviews have been submitted yet."}
                      </p>
                      {(search || statusFilter !== "All" || ratingFilter !== "All") && (
                        <button
                          type="button"
                          className="admin-action-btn secondary small"
                          onClick={() => {
                            setSearch("");
                            setStatusFilter("All");
                            setRatingFilter("All");
                            setPage(1);
                          }}
                        >
                          Clear All Filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}

                {!loading &&
                  reviews.map((rev) => {
                    const prodImg = getProductImage(rev.product);
                    return (
                      <tr key={rev._id} className={`review-row status-${rev.status}`}>
                        {/* PRODUCT COLUMN */}
                        <td className="product-col">
                          <div className="prod-cell-inner">
                            <div className="prod-thumb-box">
                              {prodImg ? (
                                <img
                                  src={prodImg}
                                  alt={rev.product?.name || "Product"}
                                  className="prod-thumb-img"
                                />
                              ) : (
                                <div className="prod-thumb-placeholder">⚗️</div>
                              )}
                            </div>
                            <div className="prod-meta">
                              <span className="prod-name" title={rev.product?.name}>
                                {rev.product?.name || "Unknown Fragrance"}
                              </span>
                              <div className="prod-tags">
                                <span className="prod-brand">{rev.product?.brand || "FEXA"}</span>
                                <span className="prod-cat-pill">
                                  {rev.product?.category || "Unisex"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* CUSTOMER COLUMN */}
                        <td className="customer-col">
                          <div className="cust-cell-inner">
                            <div className="cust-avatar">
                              {rev.user?.name?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <div className="cust-meta">
                              <span className="cust-name">{rev.user?.name || "Customer"}</span>
                              <span className="cust-email">{rev.user?.email || "—"}</span>
                            </div>
                          </div>
                        </td>

                        {/* RATING COLUMN */}
                        <td className="rating-col">
                          {renderStars(rev.rating)}
                          <span className="review-date-snippet">{formatDate(rev.createdAt)}</span>
                        </td>

                        {/* COMMENT COLUMN */}
                        <td className="comment-col">
                          <div className="comment-cell-inner">
                            {rev.title && <strong className="comment-headline">"{rev.title}"</strong>}
                            <p className="comment-body-text">{rev.comment}</p>
                          </div>
                        </td>

                        {/* STATUS COLUMN */}
                        <td className="status-col">
                          <span className={`status-pill ${rev.status}`}>
                            {rev.status === "approved" && "● APPROVED"}
                            {rev.status === "pending" && "⏳ PENDING"}
                            {rev.status === "rejected" && "✕ REJECTED"}
                          </span>
                        </td>

                        {/* ACTIONS COLUMN */}
                        <td className="actions-col">
                          <div className="action-buttons-cluster">
                            {rev.status !== "approved" && (
                              <button
                                type="button"
                                className="row-action-btn approve"
                                title="Approve Review"
                                onClick={() => handleUpdateStatus(rev._id, "approved")}
                                disabled={actionProcessing}
                              >
                                ✓
                              </button>
                            )}

                            {rev.status !== "rejected" && (
                              <button
                                type="button"
                                className="row-action-btn reject"
                                title="Reject / Hide Review"
                                onClick={() => handleUpdateStatus(rev._id, "rejected")}
                                disabled={actionProcessing}
                              >
                                ✕
                              </button>
                            )}

                            <button
                              type="button"
                              className="row-action-btn inspect"
                              title="Inspect Full Details"
                              onClick={() => {
                                setSelectedReview(rev);
                                setActiveModal("details");
                              }}
                            >
                              👁
                            </button>

                            <button
                              type="button"
                              className="row-action-btn delete"
                              title="Delete Review"
                              onClick={() => {
                                setSelectedReview(rev);
                                setActiveModal("delete");
                              }}
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <AdminPagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            pageSize={pagination.limit}
            itemName="reviews"
            onPageChange={(newPage) => setPage(newPage)}
            loading={loading}
          />
        </section>

        {/* MODAL 1: INSPECT REVIEW DETAILS */}
        {activeModal === "details" && selectedReview && (
          <div className="admin-modal-overlay" onClick={() => setActiveModal(null)}>
            <div
              className="admin-modal-container review-detail-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-title-box">
                  <span className="modal-eyebrow">MODERATION INSPECTOR</span>
                  <h3 className="modal-heading">Review Record #{selectedReview._id.slice(-6)}</h3>
                </div>
                <button
                  type="button"
                  className="modal-close-icon-btn"
                  onClick={() => setActiveModal(null)}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                {/* PRODUCT & USER CARD */}
                <div className="modal-info-duo">
                  <div className="modal-info-card">
                    <span className="info-card-label">FRAGRANCE UNDER REVIEW</span>
                    <h4>{selectedReview.product?.name || "Unknown Product"}</h4>
                    <span className="info-card-sub">
                      Brand: {selectedReview.product?.brand || "FEXA"} · Category:{" "}
                      {selectedReview.product?.category || "Unisex"}
                    </span>
                  </div>

                  <div className="modal-info-card">
                    <span className="info-card-label">REVIEWER IDENTITY</span>
                    <h4>{selectedReview.user?.name || "Customer"}</h4>
                    <span className="info-card-sub">{selectedReview.user?.email || "No email available"}</span>
                  </div>
                </div>

                {/* RATING & TIMESTAMP */}
                <div className="modal-rating-status-row">
                  <div className="modal-rating-box">
                    <span className="modal-field-label">Assigned Rating</span>
                    {renderStars(selectedReview.rating)}
                  </div>

                  <div className="modal-status-box">
                    <span className="modal-field-label">Current Status</span>
                    <span className={`status-pill ${selectedReview.status}`}>
                      {selectedReview.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="modal-date-box">
                    <span className="modal-field-label">Submitted On</span>
                    <span className="modal-date-val">{formatDate(selectedReview.createdAt)}</span>
                  </div>
                </div>

                {/* REVIEW TEXT */}
                <div className="modal-comment-full-box">
                  <span className="modal-field-label">Customer Testimony</span>
                  {selectedReview.title && (
                    <h5 className="modal-headline">"{selectedReview.title}"</h5>
                  )}
                  <p className="modal-comment-paragraph">{selectedReview.comment}</p>
                </div>
              </div>

              <div className="modal-footer">
                <div className="modal-footer-left">
                  <button
                    type="button"
                    className="modal-delete-trigger-btn"
                    onClick={() => setActiveModal("delete")}
                  >
                    🗑 Delete Permanently
                  </button>
                </div>

                <div className="modal-footer-right">
                  {selectedReview.status !== "approved" && (
                    <button
                      type="button"
                      className="modal-action-btn approve"
                      onClick={() => handleUpdateStatus(selectedReview._id, "approved")}
                      disabled={actionProcessing}
                    >
                      ✓ Approve Review
                    </button>
                  )}

                  {selectedReview.status !== "rejected" && (
                    <button
                      type="button"
                      className="modal-action-btn reject"
                      onClick={() => handleUpdateStatus(selectedReview._id, "rejected")}
                      disabled={actionProcessing}
                    >
                      ✕ Reject Review
                    </button>
                  )}

                  <button
                    type="button"
                    className="modal-action-btn secondary"
                    onClick={() => setActiveModal(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: CONFIRM DELETE MODAL */}
        {activeModal === "delete" && selectedReview && (
          <div className="admin-modal-overlay" onClick={() => setActiveModal(null)}>
            <div
              className="admin-modal-container delete-confirm-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="delete-modal-icon">⚠</div>
              <h3>Confirm Permanent Deletion</h3>
              <p>
                Are you sure you want to permanently delete this review by{" "}
                <strong>{selectedReview.user?.name || "this customer"}</strong> for{" "}
                <strong>{selectedReview.product?.name || "this fragrance"}</strong>?
              </p>
              <p className="delete-warning-subtext">
                This action cannot be undone and will recalculate product rating statistics immediately.
              </p>

              <div className="modal-footer centered">
                <button
                  type="button"
                  className="modal-action-btn secondary"
                  onClick={() => setActiveModal(null)}
                  disabled={actionProcessing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="modal-action-btn danger"
                  onClick={handleDeleteReview}
                  disabled={actionProcessing}
                >
                  {actionProcessing ? "Deleting..." : "Yes, Delete Review"}
                </button>
              </div>
            </div>
          </div>
        )}
        </main>
      </div>
    </div>
  );
}

export default AdminReviews;
