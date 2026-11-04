import React, { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "../../context/AdminAuthContext";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminPagination from "../../components/admin/AdminPagination";
import "./AdminWalletRefunds.css";

const TRANSACTION_TYPES = [
  "All",
  "Cancellation Refund",
  "Return Refund",
  "Top-up",
  "Purchase Debit",
  "Admin Adjustment",
];

const STATUS_OPTIONS = [
  "All",
  "Completed",
  "Pending",
  "Failed",
];

const formatINR = (val) => {
  if (val === undefined || val === null || isNaN(Number(val))) return "₹0.00";
  return `₹${Number(val).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

export default function AdminWalletRefunds() {
  const { admin, logoutAdmin } = useAdminAuth();

  // Navigation & Drawer
  const [activeTab, setActiveTab] = useState("wallet-refunds");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Data & Summary Stats
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    totalRefunds: 0,
    totalRefundAmount: 0,
    successfulRefunds: 0,
    pendingRefunds: 0,
    failedRefunds: 0,
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
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  // Inspection Modal
  const [selectedTx, setSelectedTx] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Fetch paginated transactions from backend
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        search: appliedSearch,
        type: typeFilter,
        status: statusFilter,
      });

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`http://localhost:5000/api/admin/wallet-refunds?${params.toString()}`, {
        credentials: "include",
      });

      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions || []);
        if (data.stats) setStats(data.stats);
        if (data.pagination) setPagination(data.pagination);
      } else {
        showToast(data.message || "Failed to load wallet transactions", "error");
      }
    } catch (err) {
      console.error("Fetch admin wallet refunds error:", err);
      showToast("Network error connecting to wallet refund service.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch, typeFilter, statusFilter, startDate, endDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Handle Search Submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setTypeFilter("All");
    setStatusFilter("All");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  // Inspect Transaction Details Modal
  const handleInspectTransaction = async (tx) => {
    setIsModalOpen(true);
    setModalLoading(true);
    setSelectedTx(null);

    try {
      const res = await fetch(`http://localhost:5000/api/admin/wallet-refunds/${tx.transactionId}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && data.transaction) {
        setSelectedTx(data.transaction);
      } else {
        // Fallback to table row data
        setSelectedTx(tx);
        showToast(data.message || "Loaded cached transaction details.", "info");
      }
    } catch (err) {
      console.error("Fetch transaction details error:", err);
      setSelectedTx(tx);
    } finally {
      setModalLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    const s = String(status || "").toUpperCase();
    if (s === "COMPLETED" || s === "SUCCESS" || s === "SUCCESSFUL") return "status-badge-completed";
    if (s === "PENDING") return "status-badge-pending";
    if (s === "FAILED") return "status-badge-failed";
    return "status-badge-default";
  };

  const getTypeBadgeClass = (type, direction) => {
    const isCredit = String(direction || "").toUpperCase() === "CREDIT";
    if (type === "Cancellation Refund") return "type-badge-cancellation";
    if (type === "Return Refund") return "type-badge-return";
    if (type === "Top-up") return "type-badge-topup";
    return isCredit ? "type-badge-credit" : "type-badge-debit";
  };

  return (
    <div className="admin-wallet-container">
      {/* SIDEBAR NAVIGATION */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={logoutAdmin}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      {/* MAIN CONTENT AREA */}
      <main className="admin-wallet-main">
        {/* TOAST ALERTS */}
        {toast && (
          <div className={`admin-toast ${toast.type}`}>
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)}>✕</button>
          </div>
        )}

        {/* HEADER SECTION */}
        <header className="admin-wallet-header">
          <div className="wallet-header-left">
            <button
              type="button"
              className="mobile-menu-toggle-btn"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              ☰
            </button>
            <div className="wallet-header-titles">
              <span className="wallet-breadcrumb">MAISON ATELIER / FINANCIAL LEDGER & REFUNDS</span>
              <h1>👛 Wallet & Refund Management</h1>
              <p>Audit trail of customer wallet transactions, cancellation refunds, and balances</p>
            </div>
          </div>
          <div className="wallet-header-actions">
            <button
              type="button"
              className="wallet-refresh-action-btn"
              onClick={fetchTransactions}
              disabled={loading}
              title="Refresh ledger"
            >
              {loading ? "⌛ Syncing..." : "↻ Refresh Ledger"}
            </button>
          </div>
        </header>

        {/* SUMMARY CARDS */}
        <section className="wallet-stats-grid">
          <div className="wallet-stat-card">
            <div className="stat-card-top">
              <span className="stat-label">TOTAL WALLET REFUNDS</span>
              <span className="stat-icon">🔄</span>
            </div>
            <div className="stat-value">{stats.totalRefunds.toLocaleString()}</div>
            <div className="stat-sub">Cancellation & Return Events</div>
          </div>

          <div className="wallet-stat-card highlight-card">
            <div className="stat-card-top">
              <span className="stat-label">TOTAL REFUND AMOUNT</span>
              <span className="stat-icon">💳</span>
            </div>
            <div className="stat-value">{formatINR(stats.totalRefundAmount)}</div>
            <div className="stat-sub">Credited directly to user wallets</div>
          </div>

          <div className="wallet-stat-card success-card">
            <div className="stat-card-top">
              <span className="stat-label">SUCCESSFUL REFUNDS</span>
              <span className="stat-icon">✓</span>
            </div>
            <div className="stat-value">{stats.successfulRefunds.toLocaleString()}</div>
            <div className="stat-sub">Completed & balance updated</div>
          </div>

          <div className="wallet-stat-card warning-card">
            <div className="stat-card-top">
              <span className="stat-label">PENDING REFUNDS</span>
              <span className="stat-icon">⏳</span>
            </div>
            <div className="stat-value">{stats.pendingRefunds.toLocaleString()}</div>
            <div className="stat-sub">Awaiting ledger clearance</div>
          </div>

          <div className="wallet-stat-card danger-card">
            <div className="stat-card-top">
              <span className="stat-label">FAILED REFUNDS</span>
              <span className="stat-icon">⚠</span>
            </div>
            <div className="stat-value">{stats.failedRefunds.toLocaleString()}</div>
            <div className="stat-sub">Exceptions requiring attention</div>
          </div>
        </section>

        {/* FILTER & SEARCH CONTROLS */}
        <section className="wallet-filter-card">
          <form onSubmit={handleSearchSubmit} className="wallet-search-bar">
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by customer name, email, order #, or transaction ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="wallet-search-input"
              />
              {search && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => {
                    setSearch("");
                    setAppliedSearch("");
                    setPage(1);
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <button type="submit" className="search-submit-btn">Search</button>
          </form>

          <div className="wallet-filter-row">
            <div className="filter-group">
              <label htmlFor="tx-type-filter">Transaction Type</label>
              <select
                id="tx-type-filter"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="wallet-select"
              >
                {TRANSACTION_TYPES.map((t) => (
                  <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="tx-status-filter">Refund Status</label>
              <select
                id="tx-status-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="wallet-select"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s === "All" ? "All Statuses" : s}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="start-date-input">Start Date</label>
              <input
                id="start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="wallet-date-input"
              />
            </div>

            <div className="filter-group">
              <label htmlFor="end-date-input">End Date</label>
              <input
                id="end-date-input"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="wallet-date-input"
              />
            </div>

            {(appliedSearch || typeFilter !== "All" || statusFilter !== "All" || startDate || endDate) && (
              <button
                type="button"
                className="reset-filters-btn"
                onClick={handleResetFilters}
              >
                ↻ Reset
              </button>
            )}
          </div>
        </section>

        {/* TRANSACTIONS TABLE */}
        <section className="wallet-table-card">
          <div className="table-header-title">
            <h2>📜 Verified Ledger Transactions</h2>
            <span className="table-count-badge">{pagination.total} records</span>
          </div>

          {loading ? (
            <div className="wallet-loading-state">
              <div className="luxury-spinner" />
              <p>Consulting secure MongoDB financial ledger...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="wallet-empty-state">
              <div className="empty-icon">👛</div>
              <h3>No Wallet Transactions Found</h3>
              <p>No refund or wallet records matched your search parameters.</p>
              {(appliedSearch || typeFilter !== "All" || statusFilter !== "All" || startDate || endDate) && (
                <button
                  type="button"
                  className="empty-reset-btn"
                  onClick={handleResetFilters}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="wallet-table-scroll">
              <table className="admin-wallet-table">
                <thead>
                  <tr>
                    <th>TRANSACTION ID</th>
                    <th>CUSTOMER</th>
                    <th>ORDER ID</th>
                    <th>PRODUCT / CONTEXT</th>
                    <th>TRANSACTION TYPE</th>
                    <th>AMOUNT</th>
                    <th>DATE & TIME</th>
                    <th>REFUND STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const isCredit =
                      String(tx.direction || "").trim().toUpperCase() === "CREDIT" ||
                      tx.direction === "Credit";

                    return (
                      <tr key={tx.transactionId || tx._id}>
                        {/* Transaction ID */}
                        <td>
                          <div className="tx-id-cell">
                            <span className="tx-id-code">{tx.transactionId}</span>
                            {tx.referenceId && (
                              <span className="tx-ref-sub">Ref: {tx.referenceId}</span>
                            )}
                          </div>
                        </td>

                        {/* Customer */}
                        <td>
                          <div className="customer-cell">
                            <span className="customer-name">{tx.customer?.name || "FEXA Patron"}</span>
                            <span className="customer-email">{tx.customer?.email || "N/A"}</span>
                          </div>
                        </td>

                        {/* Order ID */}
                        <td>
                          <div className="order-cell">
                            {tx.orderNumber ? (
                              <span className="order-number-badge">#{tx.orderNumber}</span>
                            ) : (
                              <span className="order-na-text">—</span>
                            )}
                          </div>
                        </td>

                        {/* Product / Context */}
                        <td>
                          <div className="product-context-cell">
                            <span className="product-name-text">
                              {tx.productName || tx.description || "Fragrance Order"}
                            </span>
                            {tx.itemQuantity > 1 && (
                              <span className="product-qty-tag">Qty: {tx.itemQuantity}</span>
                            )}
                          </div>
                        </td>

                        {/* Transaction Type */}
                        <td>
                          <span className={`type-badge ${getTypeBadgeClass(tx.type, tx.direction)}`}>
                            {tx.type}
                          </span>
                        </td>

                        {/* Amount */}
                        <td>
                          <span className={`tx-amount-cell ${isCredit ? "amount-credit" : "amount-debit"}`}>
                            {isCredit ? "+" : "-"}{formatINR(tx.amount)}
                          </span>
                        </td>

                        {/* Date & Time */}
                        <td>
                          <span className="tx-date-cell">{formatDateTime(tx.createdAt)}</span>
                        </td>

                        {/* Refund Status */}
                        <td>
                          <span className={`status-badge ${getStatusBadgeClass(tx.status)}`}>
                            {tx.status || "Completed"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td>
                          <button
                            type="button"
                            className="inspect-action-btn"
                            onClick={() => handleInspectTransaction(tx)}
                          >
                            Inspect 👁️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION */}
          <AdminPagination
            currentPage={page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            pageSize={10}
            itemName="wallet transactions"
            onPageChange={(newPage) => setPage(newPage)}
            loading={loading}
            variant="card-footer"
          />
        </section>

        {/* TRANSACTION INSPECTION MODAL */}
        {isModalOpen && (
          <div className="admin-modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-header-info">
                  <span className="modal-badge">TRANSACTION AUDIT</span>
                  <h3>Wallet Transaction Inspection</h3>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  ✕
                </button>
              </div>

              {modalLoading ? (
                <div className="modal-loading-body">
                  <div className="luxury-spinner" />
                  <p>Loading authoritative audit trail...</p>
                </div>
              ) : selectedTx ? (
                <div className="modal-body-scroll">
                  {/* Status Banner */}
                  <div className="modal-status-banner">
                    <div className="status-banner-left">
                      <span className="status-banner-label">STATUS</span>
                      <span className={`status-badge ${getStatusBadgeClass(selectedTx.status)}`}>
                        {selectedTx.status || "Completed"}
                      </span>
                    </div>
                    <div className="status-banner-right">
                      <span className="status-banner-label">RECORDED AMOUNT</span>
                      <span className="status-banner-amount">
                        {selectedTx.direction === "Credit" ? "+" : "-"}{formatINR(selectedTx.amount)}
                      </span>
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div className="modal-section-card">
                    <h4>👤 Patron Details</h4>
                    <div className="modal-grid-2">
                      <div className="info-pair">
                        <span className="info-title">Full Name</span>
                        <span className="info-val">{selectedTx.customer?.name || "FEXA Patron"}</span>
                      </div>
                      <div className="info-pair">
                        <span className="info-title">Email Address</span>
                        <span className="info-val">{selectedTx.customer?.email || "N/A"}</span>
                      </div>
                      <div className="info-pair">
                        <span className="info-title">Phone</span>
                        <span className="info-val">{selectedTx.customer?.phone || "N/A"}</span>
                      </div>
                      <div className="info-pair">
                        <span className="info-title">Account Reference</span>
                        <span className="info-val code-val">{selectedTx.customer?._id || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Order Details */}
                  {selectedTx.order && (
                    <div className="modal-section-card">
                      <h4>📦 Associated Order</h4>
                      <div className="modal-grid-2">
                        <div className="info-pair">
                          <span className="info-title">Order Number</span>
                          <span className="info-val code-val">#{selectedTx.order.orderNumber}</span>
                        </div>
                        <div className="info-pair">
                          <span className="info-title">Order Date</span>
                          <span className="info-val">{formatDateTime(selectedTx.order.createdAt)}</span>
                        </div>
                        <div className="info-pair">
                          <span className="info-title">Payment Method</span>
                          <span className="info-val">{selectedTx.order.paymentMethod}</span>
                        </div>
                        <div className="info-pair">
                          <span className="info-title">Payment Status</span>
                          <span className="info-val">{selectedTx.order.paymentStatus}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Product & Calculation Breakdown */}
                  <div className="modal-section-card highlight-breakdown">
                    <h4>🧮 Authoritative Refund Calculation</h4>
                    <p className="breakdown-subtext">
                      Transparent accounting showing post-offer price and proportional coupon deductions.
                    </p>

                    <div className="calculation-breakdown-table">
                      <div className="calc-row">
                        <span className="calc-label">Product Name</span>
                        <span className="calc-value font-bold">
                          {selectedTx.item?.name || selectedTx.productName || selectedTx.description}
                        </span>
                      </div>
                      <div className="calc-row">
                        <span className="calc-label">Quantity</span>
                        <span className="calc-value">{selectedTx.item?.quantity || selectedTx.itemQuantity || 1} unit(s)</span>
                      </div>
                      <div className="calc-row">
                        <span className="calc-label">Catalog Price (MRP / Original)</span>
                        <span className="calc-value">{formatINR(selectedTx.item?.originalPrice || selectedTx.itemPrice || 0)}</span>
                      </div>
                      <div className="calc-row discount-row">
                        <span className="calc-label">Product Offer Savings</span>
                        <span className="calc-value">
                          - {formatINR(selectedTx.item?.offerDiscount || selectedTx.itemOfferDiscount || 0)}
                        </span>
                      </div>
                      <div className="calc-row discount-row">
                        <span className="calc-label">Allocated Coupon Discount</span>
                        <span className="calc-value">
                          - {formatINR(selectedTx.item?.couponDiscount || selectedTx.itemCouponDiscount || 0)}
                        </span>
                      </div>
                      <div className="calc-row final-row">
                        <span className="calc-label font-bold">Net Refund Credited to Wallet</span>
                        <span className="calc-value final-amount">{formatINR(selectedTx.amount)}</span>
                      </div>
                    </div>

                    {(selectedTx.item?.refundReason || selectedTx.refundReason) && (
                      <div className="refund-reason-box">
                        <span className="reason-label">Cancellation Reason:</span>
                        <span className="reason-text">
                          "{selectedTx.item?.refundReason || selectedTx.refundReason}"
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Ledger Audit Details */}
                  <div className="modal-section-card">
                    <h4>📜 Wallet Balance Snapshot</h4>
                    <div className="modal-grid-2">
                      <div className="info-pair">
                        <span className="info-title">Transaction ID</span>
                        <span className="info-val code-val">{selectedTx.transactionId}</span>
                      </div>
                      <div className="info-pair">
                        <span className="info-title">Reference ID</span>
                        <span className="info-val code-val">{selectedTx.referenceId || "N/A"}</span>
                      </div>
                      <div className="info-pair">
                        <span className="info-title">Balance Before Transaction</span>
                        <span className="info-val">{formatINR(selectedTx.balanceBefore)}</span>
                      </div>
                      <div className="info-pair">
                        <span className="info-title">Balance After Transaction</span>
                        <span className="info-val font-bold" style={{ color: "#c084fc" }}>
                          {formatINR(selectedTx.balanceAfter)}
                        </span>
                      </div>
                      <div className="info-pair">
                        <span className="info-title">Processed Timestamp</span>
                        <span className="info-val">{formatDateTime(selectedTx.createdAt)}</span>
                      </div>
                      <div className="info-pair">
                        <span className="info-title">Transaction Type</span>
                        <span className="info-val">{selectedTx.type} ({selectedTx.direction})</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-action-btn close"
                  onClick={() => setIsModalOpen(false)}
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

