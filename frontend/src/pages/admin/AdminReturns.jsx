import React, { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "../../context/AdminAuthContext";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminPagination from "../../components/admin/AdminPagination";
import "./AdminReturns.css";

const STATUS_FILTER_OPTIONS = [
  "All",
  "Requested",
  "Under Review",
  "Approved",
  "Refunded",
  "Rejected",
];

const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  return `http://localhost:5000${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
};

const formatINR = (val) => {
  if (val === undefined || val === null) return "₹0.00";
  return `₹${Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminReturns() {
  const { admin, logoutAdmin } = useAdminAuth();

  // Navigation & Drawer
  const [activeTab, setActiveTab] = useState("returns");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Return data & stats
  const [returnsList, setReturnsList] = useState([]);
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    refundedRequests: 0,
    totalRefundedAmount: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals & Action States
  const [toast, setToast] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [approveConfirmReturn, setApproveConfirmReturn] = useState(null);
  const [rejectModalReturn, setRejectModalReturn] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [actionProcessing, setActionProcessing] = useState(false);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Fetch returns list from backend
  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        search: appliedSearch,
        status: statusFilter,
      });

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`http://localhost:5000/api/admin/returns?${params.toString()}`, {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReturnsList(data.returns || []);
        if (data.stats) setStats(data.stats);
        if (data.pagination) {
          setPagination(data.pagination);
          if (page > data.pagination.totalPages && data.pagination.totalPages >= 1) {
            setPage(data.pagination.totalPages);
          }
        }
      } else {
        showToast(data.message || "Failed to load return requests.", "error");
      }
    } catch (err) {
      console.error("Fetch admin returns error:", err);
      showToast("Unable to reach FEXA return service.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch, statusFilter, startDate, endDate]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  // Handle Search Submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const handleResetFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setStatusFilter("All");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  // ========================================================
  // APPROVE RETURN REQUEST ACTION
  // ========================================================
  const handleConfirmApprove = async () => {
    if (!approveConfirmReturn || actionProcessing) return;

    try {
      setActionProcessing(true);
      const res = await fetch(
        `http://localhost:5000/api/admin/returns/${approveConfirmReturn._id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ adminNotes }),
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          `Return #${approveConfirmReturn.requestNumber} approved! ${formatINR(data.refundAmount)} credited to customer's wallet.`,
          "success"
        );
        setApproveConfirmReturn(null);
        setAdminNotes("");
        if (isDetailModalOpen) setIsDetailModalOpen(false);
        fetchReturns();
      } else {
        showToast(data.message || "Failed to approve return.", "error");
      }
    } catch (err) {
      console.error("Approve return error:", err);
      showToast("Server communication error during approval.", "error");
    } finally {
      setActionProcessing(false);
    }
  };

  // ========================================================
  // REJECT RETURN REQUEST ACTION
  // ========================================================
  const handleConfirmReject = async () => {
    if (!rejectModalReturn || actionProcessing) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 3) {
      showToast("Please provide a valid rejection reason.", "error");
      return;
    }

    try {
      setActionProcessing(true);
      const res = await fetch(
        `http://localhost:5000/api/admin/returns/${rejectModalReturn._id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            rejectionReason: rejectionReason.trim(),
            adminNotes: adminNotes.trim(),
          }),
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Return request #${rejectModalReturn.requestNumber} has been rejected.`, "success");
        setRejectModalReturn(null);
        setRejectionReason("");
        setAdminNotes("");
        if (isDetailModalOpen) setIsDetailModalOpen(false);
        fetchReturns();
      } else {
        showToast(data.message || "Failed to reject return.", "error");
      }
    } catch (err) {
      console.error("Reject return error:", err);
      showToast("Server error during rejection.", "error");
    } finally {
      setActionProcessing(false);
    }
  };

  return (
    <div className="admin-returns-container">
      {/* SIDEBAR NAVIGATION */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={logoutAdmin}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      {/* MAIN CONTENT AREA */}
      <main className="admin-returns-main">
        {/* HEADER */}
        <header className="admin-returns-header">
          <div className="returns-header-left">
            <button
              type="button"
              className="mobile-menu-toggle-btn"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open Navigation"
            >
              ☰
            </button>
            <div className="returns-header-titles">
              <h1>
                <span>🔄</span> Return Management
              </h1>
              <p>Customer Fragrance Returns & Wallet Refund Verification</p>
            </div>
          </div>

          <div className="returns-header-actions">
            <button
              type="button"
              className="refresh-sync-btn"
              onClick={fetchReturns}
              disabled={loading}
              title="Refresh Return Ledger"
            >
              <span>{loading ? "⌛" : "↻"}</span>
              <span>Sync Ledger</span>
            </button>
          </div>
        </header>

        {/* STATS OVERVIEW CARDS */}
        <section className="returns-stats-grid">
          <div className="returns-stat-card">
            <div className="stat-icon-wrap">
              <span>📋</span>
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Requests</span>
              <span className="stat-value">{stats.totalRequests}</span>
            </div>
          </div>

          <div className="returns-stat-card">
            <div className="stat-icon-wrap pending">
              <span>⏳</span>
            </div>
            <div className="stat-info">
              <span className="stat-label">Pending Review</span>
              <span className="stat-value highlight">{stats.pendingRequests}</span>
            </div>
          </div>

          <div className="returns-stat-card">
            <div className="stat-icon-wrap refunded">
              <span>✨</span>
            </div>
            <div className="stat-info">
              <span className="stat-label">Refunded (Wallet)</span>
              <span className="stat-value">{stats.refundedRequests}</span>
            </div>
          </div>

          <div className="returns-stat-card">
            <div className="stat-icon-wrap rejected">
              <span>✕</span>
            </div>
            <div className="stat-info">
              <span className="stat-label">Declined Requests</span>
              <span className="stat-value">{stats.rejectedRequests}</span>
            </div>
          </div>

          <div className="returns-stat-card">
            <div className="stat-icon-wrap refunded">
              <span>👛</span>
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Refunded Base</span>
              <span className="stat-value highlight">{formatINR(stats.totalRefundedAmount)}</span>
            </div>
          </div>
        </section>

        {/* SEARCH & FILTERS TOOLBAR */}
        <section className="returns-filter-toolbar">
          <form onSubmit={handleSearchSubmit} className="filter-row-top">
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by Request #, Order #, Patron, or Fragrance..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              {STATUS_FILTER_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st === "All" ? "All Statuses" : st}
                </option>
              ))}
            </select>

            <button type="submit" className="filter-search-btn">
              <span>🔍</span> Search
            </button>

            {(appliedSearch || statusFilter !== "All" || startDate || endDate) && (
              <button
                type="button"
                className="reset-filter-btn"
                onClick={handleResetFilters}
              >
                Reset Filters ✕
              </button>
            )}
          </form>
        </section>

        {/* TABLE CARD */}
        <section className="returns-table-card">
          <div className="returns-table-responsive">
            <table className="returns-table">
              <thead>
                <tr>
                  <th className="col-id">Request ID & Date</th>
                  <th className="col-order">Order #</th>
                  <th className="col-customer">Customer Patron</th>
                  <th className="col-item">Fragrance Item</th>
                  <th className="col-qty">Qty</th>
                  <th className="col-reason">Return Reason</th>
                  <th className="col-refund">Eligible Refund</th>
                  <th className="col-status">Current Status</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "40px" }}>
                      <div style={{ color: "#c084fc", fontSize: "1rem" }}>
                        Loading return requests ledger...
                      </div>
                    </td>
                  </tr>
                ) : returnsList.length === 0 ? (
                  <tr>
                    <td colSpan="9">
                      <div className="returns-empty-state">
                        <div className="empty-state-icon">📦</div>
                        <h3>No return requests found</h3>
                        <p>No customer return requests match your active filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  returnsList.map((reqItem) => {
                    const statusClass = (reqItem.status || "requested")
                      .toLowerCase()
                      .replace(/\s+/g, "-");

                    const isRefunded = reqItem.status === "Refunded";
                    const isRejected = reqItem.status === "Rejected";
                    const canAct = !isRefunded && !isRejected;

                    return (
                      <tr key={reqItem._id}>
                        {/* Request ID & Date */}
                        <td className="col-id">
                          <div className="return-id-cell">
                            <span className="return-id-tag" title={reqItem.requestNumber}>
                              {reqItem.requestNumber}
                            </span>
                            <span className="return-date-sub">
                              {formatDateTime(reqItem.createdAt)}
                            </span>
                          </div>
                        </td>

                        {/* Order Number */}
                        <td className="col-order">
                          <span className="order-badge-pill" title={reqItem.orderNumber}>
                            {reqItem.orderNumber}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="col-customer">
                          <div className="customer-cell">
                            <span className="customer-name" title={reqItem.user?.name}>
                              {reqItem.user?.name || "Patron"}
                            </span>
                            <span className="customer-email" title={reqItem.user?.email}>
                              {reqItem.user?.email || "N/A"}
                            </span>
                          </div>
                        </td>

                        {/* Fragrance Item */}
                        <td className="col-item">
                          <div className="product-snapshot-cell">
                            {reqItem.item?.image ? (
                              <img
                                src={getImageUrl(reqItem.item.image)}
                                alt={reqItem.item.productName}
                                className="product-thumb"
                              />
                            ) : (
                              <div className="product-thumb-placeholder">⚗️</div>
                            )}
                            <div className="product-title-group">
                              <span
                                className="product-name-txt"
                                title={reqItem.item?.productName}
                              >
                                {reqItem.item?.productName}
                              </span>
                              <span className="product-variant-txt">
                                {reqItem.item?.variantVolume || "100ml"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="col-qty">
                          {reqItem.item?.requestedQuantity || 1}
                        </td>

                        {/* Return Reason */}
                        <td className="col-reason">
                          <span className="col-reason-text" title={reqItem.customerNotes || reqItem.returnReason}>
                            {reqItem.returnReason}
                          </span>
                        </td>

                        {/* Eligible Refund */}
                        <td className="col-refund">
                          <div className="refund-amount-cell">
                            <span className="refund-val">
                              {formatINR(reqItem.actualRefundAmount || reqItem.eligibleRefundAmount)}
                            </span>
                            <span className="refund-sub">Historical paid</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="col-status">
                          <span className={`return-status-badge ${statusClass}`}>
                            {reqItem.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="col-actions">
                          <div className="returns-actions-cell">
                            <button
                              type="button"
                              className="action-btn view-btn"
                              onClick={() => {
                                setSelectedReturn(reqItem);
                                setIsDetailModalOpen(true);
                              }}
                              title="Inspect Details"
                            >
                              Details
                            </button>

                            {canAct && (
                              <>
                                <button
                                  type="button"
                                  className="action-btn approve-btn"
                                  onClick={() => setApproveConfirmReturn(reqItem)}
                                  title="Approve & Disburse Refund to Wallet"
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  type="button"
                                  className="action-btn reject-btn"
                                  onClick={() => {
                                    setRejectModalReturn(reqItem);
                                    setRejectionReason("");
                                  }}
                                  title="Decline Return"
                                >
                                  ✕ Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* STANDARDIZED CENTERED PAGINATION */}
          <AdminPagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            pageSize={pagination.limit}
            itemName="returns"
            onPageChange={(p) => setPage(p)}
            loading={loading}
            variant="card-footer"
            className="returns-centered-pagination"
          />
        </section>
      </main>

      {/* ========================================================
          MODAL: DETAILED RETURN INSPECTION
         ======================================================== */}
      {isDetailModalOpen && selectedReturn && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="modal-header">
              <h2>
                <span>🔍</span> Return #{selectedReturn.requestNumber}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsDetailModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* STATUS BANNER */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "#191924",
                  borderRadius: "8px",
                  border: "1px solid rgba(192, 132, 252, 0.2)",
                }}
              >
                <div>
                  <span style={{ fontSize: "0.74rem", color: "#9494a8", display: "block" }}>
                    CURRENT LIFECYCLE STATE
                  </span>
                  <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff" }}>
                    {selectedReturn.status}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.74rem", color: "#9494a8", display: "block" }}>
                    REQUESTED ON
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "#e2e8f0" }}>
                    {formatDateTime(selectedReturn.createdAt)}
                  </span>
                </div>
              </div>

              {/* PATRON & ORDER DETAILS */}
              <div className="modal-detail-group">
                <h4 className="modal-group-title">Patron & Order Snapshot</h4>
                <div className="detail-grid-2">
                  <div className="detail-item-pair">
                    <span className="lbl">Customer Name</span>
                    <span className="val">{selectedReturn.user?.name || "Patron"}</span>
                  </div>
                  <div className="detail-item-pair">
                    <span className="lbl">Customer Email</span>
                    <span className="val">{selectedReturn.user?.email || "N/A"}</span>
                  </div>
                  <div className="detail-item-pair">
                    <span className="lbl">Order Number</span>
                    <span className="val">{selectedReturn.orderNumber}</span>
                  </div>
                  <div className="detail-item-pair">
                    <span className="lbl">Order Payment Method</span>
                    <span className="val">
                      {selectedReturn.order?.paymentMethod || "Verified Payment"}
                    </span>
                  </div>
                </div>
              </div>

              {/* PRODUCT & HISTORICAL PRICING SNAPSHOT */}
              <div className="modal-detail-group">
                <h4 className="modal-group-title">Returned Fragrance & Refund Calculation</h4>
                <div style={{ display: "flex", gap: "14px", alignItems: "center", marginBottom: "14px" }}>
                  {selectedReturn.item?.image ? (
                    <img
                      src={getImageUrl(selectedReturn.item.image)}
                      alt={selectedReturn.item.productName}
                      style={{ width: "50px", height: "50px", borderRadius: "8px", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ fontSize: "2rem" }}>⚗️</div>
                  )}
                  <div>
                    <div style={{ fontWeight: 700, color: "#ffffff" }}>
                      {selectedReturn.item?.productName}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#c084fc" }}>
                      Volume: {selectedReturn.item?.variantVolume || "100ml"} | Quantity:{" "}
                      {selectedReturn.item?.requestedQuantity || 1} unit(s)
                    </div>
                  </div>
                </div>

                <div className="pricing-calc-box">
                  <div className="pricing-calc-row">
                    <span>Original Catalog Unit Price</span>
                    <span>{formatINR(selectedReturn.item?.unitPrice)}</span>
                  </div>
                  {selectedReturn.item?.perUnitOfferDiscount > 0 && (
                    <div className="pricing-calc-row" style={{ color: "#38bdf8" }}>
                      <span>- Automatic Offer Discount</span>
                      <span>-{formatINR(selectedReturn.item?.perUnitOfferDiscount)}</span>
                    </div>
                  )}
                  {selectedReturn.item?.perUnitCouponDiscount > 0 && (
                    <div className="pricing-calc-row" style={{ color: "#c084fc" }}>
                      <span>- Allocated Coupon Discount</span>
                      <span>-{formatINR(selectedReturn.item?.perUnitCouponDiscount)}</span>
                    </div>
                  )}
                  <div className="pricing-calc-row">
                    <span>Final Net Paid Amount per Unit</span>
                    <span>{formatINR(selectedReturn.item?.discountedUnitAmount)}</span>
                  </div>
                  <div className="pricing-calc-row highlight-final">
                    <span>Total Authoritative Refund Base</span>
                    <span>
                      {formatINR(selectedReturn.actualRefundAmount || selectedReturn.eligibleRefundAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* REASON & CUSTOMER EXPLANATION */}
              <div className="modal-detail-group">
                <h4 className="modal-group-title">Return Reason & Notes</h4>
                <div style={{ marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "#9494a8", display: "block" }}>
                    Selected Reason:
                  </span>
                  <span style={{ fontWeight: 600, color: "#f87171" }}>
                    {selectedReturn.returnReason}
                  </span>
                </div>
                {selectedReturn.customerNotes && (
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "#9494a8", display: "block" }}>
                      Additional Details from Customer:
                    </span>
                    <p style={{ margin: "4px 0 0", color: "#e2e8f0", fontSize: "0.85rem" }}>
                      "{selectedReturn.customerNotes}"
                    </p>
                  </div>
                )}
              </div>

              {/* REJECTION REASON (IF REJECTED) */}
              {selectedReturn.rejectionReason && (
                <div
                  className="modal-detail-group"
                  style={{ border: "1px solid rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.08)" }}
                >
                  <h4 className="modal-group-title" style={{ color: "#f87171" }}>
                    Admin Rejection Reason
                  </h4>
                  <p style={{ margin: 0, color: "#fca5a5", fontSize: "0.88rem" }}>
                    {selectedReturn.rejectionReason}
                  </p>
                </div>
              )}

              {/* WALLET TRANSACTION (IF REFUNDED) */}
              {selectedReturn.walletTransactionId && (
                <div
                  className="modal-detail-group"
                  style={{ border: "1px solid rgba(16, 185, 129, 0.4)", background: "rgba(16, 185, 129, 0.08)" }}
                >
                  <h4 className="modal-group-title" style={{ color: "#34d399" }}>
                    Wallet Refund Disbursement
                  </h4>
                  <div className="detail-grid-2">
                    <div className="detail-item-pair">
                      <span className="lbl">Transaction Reference</span>
                      <span className="val" style={{ fontFamily: "monospace", color: "#34d399" }}>
                        {selectedReturn.walletTransactionId}
                      </span>
                    </div>
                    <div className="detail-item-pair">
                      <span className="lbl">Refunded At</span>
                      <span className="val">{formatDateTime(selectedReturn.refundedAt)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="action-btn view-btn"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Close
              </button>
              {selectedReturn.status !== "Refunded" && selectedReturn.status !== "Rejected" && (
                <>
                  <button
                    type="button"
                    className="action-btn reject-btn"
                    onClick={() => {
                      setRejectModalReturn(selectedReturn);
                      setRejectionReason("");
                    }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="action-btn approve-btn"
                    onClick={() => setApproveConfirmReturn(selectedReturn)}
                  >
                    ✓ Approve & Credit Wallet
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: APPROVE CONFIRMATION DIALOG
         ======================================================== */}
      {approveConfirmReturn && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>
                <span>✓</span> Approve Return & Credit Wallet
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setApproveConfirmReturn(null)}
                disabled={actionProcessing}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: "#cbd5e1", lineHeight: 1.5, margin: 0 }}>
                You are authorizing the return of{" "}
                <strong style={{ color: "#ffffff" }}>
                  {approveConfirmReturn.item?.requestedQuantity || 1} unit(s)
                </strong>{" "}
                of{" "}
                <strong style={{ color: "#c084fc" }}>
                  {approveConfirmReturn.item?.productName}
                </strong>
                .
              </p>

              <div
                style={{
                  background: "#191924",
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                }}
              >
                <div style={{ fontSize: "0.78rem", color: "#9494a8", marginBottom: "4px" }}>
                  AMOUNT TO BE CREDITED TO CUSTOMER WALLET:
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#34d399" }}>
                  {formatINR(
                    approveConfirmReturn.actualRefundAmount ||
                      approveConfirmReturn.eligibleRefundAmount
                  )}
                </div>
                <div style={{ fontSize: "0.74rem", color: "#9494a8", marginTop: "4px" }}>
                  Source: Historical discounted purchase amount after coupon & automatic offer deductions.
                </div>
              </div>

              <div style={{ fontSize: "0.82rem", color: "#9494a8", lineHeight: 1.4 }}>
                ✓ Customer's FEXA Wallet will be credited immediately.
                <br />
                ✓ Variant stock will be atomically restored (+
                {approveConfirmReturn.item?.requestedQuantity || 1} unit).
                <br />
                ✓ Return status will be marked as <strong>Refunded</strong>.
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", color: "#9494a8", display: "block", marginBottom: "6px" }}>
                  Optional Admin Note:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Approved after quality inspection."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#191924",
                    border: "1px solid rgba(192, 132, 252, 0.2)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="action-btn view-btn"
                onClick={() => setApproveConfirmReturn(null)}
                disabled={actionProcessing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="action-btn approve-btn"
                onClick={handleConfirmApprove}
                disabled={actionProcessing}
              >
                {actionProcessing ? "Processing Credit..." : "Confirm Approval & Credit Wallet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: REJECT RETURN REQUEST DIALOG
         ======================================================== */}
      {rejectModalReturn && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>
                <span style={{ color: "#f87171" }}>✕</span> Decline Return Request
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setRejectModalReturn(null)}
                disabled={actionProcessing}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: "#cbd5e1", margin: 0 }}>
                Please provide an explanation for rejecting Return #
                <strong>{rejectModalReturn.requestNumber}</strong>. The customer will see this
                decision note in their return status.
              </p>

              <div>
                <label
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "#f87171",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Rejection Reason (Required) *
                </label>
                <textarea
                  className="rejection-textarea"
                  placeholder="Provide a clear, respectful reason for declining this return..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows="4"
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", color: "#9494a8", display: "block", marginBottom: "6px" }}>
                  Internal Admin Note (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bottle inspected; seal was already opened."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#191924",
                    border: "1px solid rgba(192, 132, 252, 0.2)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="action-btn view-btn"
                onClick={() => setRejectModalReturn(null)}
                disabled={actionProcessing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="action-btn reject-btn"
                onClick={handleConfirmReject}
                disabled={actionProcessing || !rejectionReason.trim()}
              >
                {actionProcessing ? "Declining..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`admin-toast-banner ${toast.type}`}>
          <span>{toast.type === "success" ? "✓" : "⚠️"}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
