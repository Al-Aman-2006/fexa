import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAdminAuth } from "../../context/AdminAuthContext";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminPagination from "../../components/admin/AdminPagination";
import "./AdminDashboard.css";
import "./AdminOrders.css";

const STATUS_OPTIONS = [
  "All",
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
  "Return Requested",
  "Return Approved",
  "Return Rejected",
  "Returned",
  "Refunded",
];

const PAYMENT_STATUS_OPTIONS = ["All", "Pending", "Paid", "Failed"];
const PAYMENT_METHOD_OPTIONS = ["All", "COD", "Razorpay", "UPI", "Card", "NetBanking"];

const COURIER_PROVIDERS = [
  "Blue Dart",
  "Delhivery",
  "DTDC",
  "FedEx India",
  "Ecom Express",
  "India Post Speed Post",
  "Shadowfax",
  "Shiprocket",
  "Bespoke Atelier Courier",
];

export default function AdminOrders() {
  const { admin, logoutAdmin } = useAdminAuth();

  // Navigation & Mobile drawer state
  const [activeTab, setActiveTab] = useState("orders");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Orders data & stats
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    processingOrders: 0,
    shippedOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    returnRequests: 0,
    recognizedRevenue: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalOrders: 0,
    totalPages: 1,
  });

  // Filters state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("All");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("All");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("All");
  const [datePreset, setDatePreset] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // UI state
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Order Details Modal / Drawer state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalAlert, setModalAlert] = useState(null);

  // Status & Tracking update states
  const [targetStatus, setTargetStatus] = useState("");
  const [adminStatusNote, setAdminStatusNote] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [trackingCourier, setTrackingCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [trackingUpdating, setTrackingUpdating] = useState(false);

  const [targetPaymentStatus, setTargetPaymentStatus] = useState("");
  const [paymentUpdating, setPaymentUpdating] = useState(false);

  const [returnProcessingId, setReturnProcessingId] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);

  // Download Admin Order Invoice PDF
  const handleAdminDownloadPDF = async (orderId, orderNumber) => {
    try {
      setDownloadingPdfId(orderId);
      const res = await fetch(`http://localhost:5000/api/admin/orders/${orderId}/invoice`, {
        credentials: "include",
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
      console.error("Admin order PDF download error:", err);
      alert(err.message || "Failed to download order PDF invoice.");
    } finally {
      setDownloadingPdfId(null);
    }
  };

  // Format currency in INR
  const formatINR = (val) => {
    if (val === undefined || val === null) return "₹0";
    return `₹${Number(val).toLocaleString("en-IN")}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Compute date range based on preset
  const computedDateRange = useMemo(() => {
    if (datePreset === "today") {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      return { startDate: start, endDate: "" };
    }
    if (datePreset === "last7days") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { startDate: d.toISOString(), endDate: "" };
    }
    if (datePreset === "thisMonth") {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      return { startDate: start, endDate: "" };
    }
    if (datePreset === "custom") {
      return {
        startDate: customStart ? new Date(customStart).toISOString() : "",
        endDate: customEnd ? new Date(customEnd).toISOString() : "",
      };
    }
    return { startDate: "", endDate: "" };
  }, [datePreset, customStart, customEnd]);

  // Fetch orders from backend API
  const fetchOrders = useCallback(
    async (targetPage = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: targetPage,
          limit: 10,
          sortBy,
          sortOrder,
        });

        if (appliedSearch) params.set("search", appliedSearch);
        if (orderStatusFilter !== "All") params.set("orderStatus", orderStatusFilter);
        if (paymentStatusFilter !== "All") params.set("paymentStatus", paymentStatusFilter);
        if (paymentMethodFilter !== "All") params.set("paymentMethod", paymentMethodFilter);
        if (computedDateRange.startDate) params.set("startDate", computedDateRange.startDate);
        if (computedDateRange.endDate) params.set("endDate", computedDateRange.endDate);

        const response = await fetch(
          `http://localhost:5000/api/admin/orders?${params.toString()}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        const data = await response.json();

        if (response.ok && data.success) {
          setOrders(data.orders || []);
          setPagination(
            data.pagination || { page: 1, limit: 10, totalOrders: 0, totalPages: 1 }
          );
          if (data.stats) {
            setStats(data.stats);
          }
        } else {
          setToast({
            type: "error",
            text: data.message || "Failed to load orders.",
          });
        }
      } catch (err) {
        console.error("Fetch admin orders error:", err);
        setToast({
          type: "error",
          text: "Unable to connect to the atelier server.",
        });
      } finally {
        setLoading(false);
      }
    },
    [
      appliedSearch,
      orderStatusFilter,
      paymentStatusFilter,
      paymentMethodFilter,
      computedDateRange,
      sortBy,
      sortOrder,
    ]
  );

  useEffect(() => {
    fetchOrders(page);
  }, [fetchOrders, page]);

  // Handle Search Submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const handleClearFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setOrderStatusFilter("All");
    setPaymentStatusFilter("All");
    setPaymentMethodFilter("All");
    setDatePreset("all");
    setCustomStart("");
    setCustomEnd("");
    setPage(1);
  };

  // Open Order Details Modal
  const handleOpenOrderModal = async (orderItem) => {
    try {
      setIsDetailModalOpen(true);
      setDetailLoading(true);
      setModalAlert(null);
      setSelectedOrder(null);
      setAdminStatusNote("");

      const response = await fetch(
        `http://localhost:5000/api/admin/orders/${orderItem._id}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        const ord = data.order;
        setSelectedOrder(ord);
        setTargetStatus(ord.allowedNextStatuses?.[0] || "");
        setTrackingCourier(ord.trackingInfo?.courierProvider || "");
        setTrackingNumber(ord.trackingInfo?.trackingNumber || "");
        setTrackingUrl(ord.trackingInfo?.trackingUrl || "");
        setTargetPaymentStatus(ord.paymentStatus || "Pending");
      } else {
        setModalAlert({
          type: "error",
          message: data.message || "Unable to fetch complete order snapshot.",
        });
      }
    } catch (err) {
      console.error("Open order details error:", err);
      setModalAlert({
        type: "error",
        message: "Network communication failure.",
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseOrderModal = () => {
    setIsDetailModalOpen(false);
    setSelectedOrder(null);
    setModalAlert(null);
  };

  // Update Status Handler
  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!selectedOrder || !targetStatus) return;

    // Frontend validation: Prevent shipping or delivery if payment has failed or online payment is unverified
    const FULFILLMENT_STATUSES = ["Dispatched", "Shipped", "Out for Delivery", "Delivered"];
    if (FULFILLMENT_STATUSES.includes(targetStatus)) {
      if (selectedOrder.paymentStatus === "Failed") {
        setModalAlert({
          type: "error",
          message: "Payment has failed. This order cannot be shipped or delivered until payment is successfully completed.",
        });
        return;
      }
      if (selectedOrder.paymentMethod !== "COD" && selectedOrder.paymentStatus !== "Paid") {
        setModalAlert({
          type: "error",
          message: "Online payment is pending verification. This order cannot be shipped or delivered until payment is confirmed as Paid.",
        });
        return;
      }
    }

    try {
      setStatusUpdating(true);
      setModalAlert(null);

      const response = await fetch(
        `http://localhost:5000/api/admin/orders/${selectedOrder._id}/status`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: targetStatus,
            note: adminStatusNote.trim(),
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setModalAlert({
          type: "success",
          message: data.message || "Order status successfully updated.",
        });
        setSelectedOrder((prev) => ({
          ...prev,
          ...data.order,
        }));
        setTargetStatus(data.order.allowedNextStatuses?.[0] || "");
        setAdminStatusNote("");
        fetchOrders(page);
      } else {
        setModalAlert({
          type: "error",
          message: data.message || "Failed to update status transition.",
        });
      }
    } catch (err) {
      console.error("Update status error:", err);
      setModalAlert({
        type: "error",
        message: "Failed to connect to the atelier server.",
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  // Update Tracking Information Handler
  const handleTrackingUpdate = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    // Frontend validation: Prevent updating tracking if payment is failed or unverified online
    if (selectedOrder.paymentStatus === "Failed") {
      setModalAlert({
        type: "error",
        message: "Cannot register or publish shipment tracking for an order with failed payment.",
      });
      return;
    }
    if (selectedOrder.paymentMethod !== "COD" && selectedOrder.paymentStatus !== "Paid") {
      setModalAlert({
        type: "error",
        message: "Cannot register or publish shipment tracking while online payment is pending verification.",
      });
      return;
    }

    try {
      setTrackingUpdating(true);
      setModalAlert(null);

      const response = await fetch(
        `http://localhost:5000/api/admin/orders/${selectedOrder._id}/tracking`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courierProvider: trackingCourier.trim(),
            trackingNumber: trackingNumber.trim(),
            trackingUrl: trackingUrl.trim(),
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setModalAlert({
          type: "success",
          message: "Shipment tracking details saved and published.",
        });
        setSelectedOrder((prev) => ({
          ...prev,
          ...data.order,
        }));
        fetchOrders(page);
      } else {
        setModalAlert({
          type: "error",
          message: data.message || "Failed to save tracking details.",
        });
      }
    } catch (err) {
      console.error("Update tracking error:", err);
      setModalAlert({
        type: "error",
        message: "Failed to connect to the atelier server.",
      });
    } finally {
      setTrackingUpdating(false);
    }
  };

  // Update Payment Status Handler
  const handlePaymentUpdate = async (e) => {
    e.preventDefault();
    if (!selectedOrder || !targetPaymentStatus) return;

    try {
      setPaymentUpdating(true);
      setModalAlert(null);

      const response = await fetch(
        `http://localhost:5000/api/admin/orders/${selectedOrder._id}/payment-status`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentStatus: targetPaymentStatus,
            note: "Payment status reconciled by admin console.",
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setModalAlert({
          type: "success",
          message: data.message || "Payment status reconciled.",
        });
        setSelectedOrder((prev) => ({
          ...prev,
          ...data.order,
        }));
        fetchOrders(page);
      } else {
        setModalAlert({
          type: "error",
          message: data.message || "Failed to update payment status.",
        });
      }
    } catch (err) {
      console.error("Update payment status error:", err);
      setModalAlert({
        type: "error",
        message: "Failed to connect to the server.",
      });
    } finally {
      setPaymentUpdating(false);
    }
  };

  // Handle Approve Item Return
  const handleApproveItemReturn = async (itemId) => {
    if (!selectedOrder || !itemId) return;
    try {
      setReturnProcessingId(itemId);
      setModalAlert(null);

      const response = await fetch(
        `http://localhost:5000/api/admin/orders/${selectedOrder._id}/items/${itemId}/approve-return`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setModalAlert({
          type: "success",
          message: data.message || "Return approved and inventory restocked.",
        });
        setSelectedOrder((prev) => ({
          ...prev,
          ...data.order,
        }));
        fetchOrders(page);
      } else {
        setModalAlert({
          type: "error",
          message: data.message || "Failed to approve return request.",
        });
      }
    } catch (err) {
      console.error("Approve return error:", err);
      setModalAlert({
        type: "error",
        message: "Failed to connect to the server.",
      });
    } finally {
      setReturnProcessingId(null);
    }
  };

  // Handle Reject Item Return
  const handleRejectItemReturn = async (itemId) => {
    if (!selectedOrder || !itemId) return;
    try {
      setReturnProcessingId(itemId);
      setModalAlert(null);

      const response = await fetch(
        `http://localhost:5000/api/admin/orders/${selectedOrder._id}/items/${itemId}/reject-return`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Declined after atelier quality inspection." }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setModalAlert({
          type: "success",
          message: data.message || "Return request rejected.",
        });
        setSelectedOrder((prev) => ({
          ...prev,
          ...data.order,
        }));
        fetchOrders(page);
      } else {
        setModalAlert({
          type: "error",
          message: data.message || "Failed to reject return request.",
        });
      }
    } catch (err) {
      console.error("Reject return error:", err);
      setModalAlert({
        type: "error",
        message: "Failed to connect to the server.",
      });
    } finally {
      setReturnProcessingId(null);
    }
  };

  // Status Badge Class Resolver
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Pending":
      case "Confirmed":
        return "badge-pending";
      case "Processing":
        return "badge-processing";
      case "Dispatched":
      case "Shipped":
        return "badge-shipped";
      case "Out for Delivery":
        return "badge-out-for-delivery";
      case "Delivered":
        return "badge-delivered";
      case "Cancelled":
        return "badge-cancelled";
      case "Return Requested":
        return "badge-return-requested";
      case "Return Approved":
      case "Returned":
      case "Refunded":
        return "badge-returned";
      case "Return Rejected":
        return "badge-return-rejected";
      default:
        return "badge-processing";
    }
  };

  const getPaymentBadgeClass = (status) => {
    switch (status) {
      case "Paid":
        return "badge-paid";
      case "Failed":
        return "badge-failed";
      default:
        return "badge-pending";
    }
  };

  return (
    <div className="admin-dashboard-page">
      {/* SIDEBAR NAVIGATION */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={logoutAdmin}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      {/* MAIN LAYOUT WRAPPER */}
      <div className="admin-main-wrapper">
        {/* TOP COMMAND BAR */}
        <header className="admin-command-bar">
          <div className="command-bar-left">
            <button
              type="button"
              className="admin-hamburger-btn"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open navigation sidebar"
            >
              ☰
            </button>
            <div className="admin-quick-search-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search orders, patrons, AWB..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchSubmit(e);
                }}
              />
            </div>
          </div>

          <div className="command-bar-right">
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
        </header>

        {/* MAIN ORDERS CONTENT CONTAINER */}
        <main className="admin-orders-container">
          {/* TOAST NOTIFICATION */}
          {toast && (
            <div className={`admin-toast ${toast.type}`}>
              <span>{toast.type === "success" ? "✓" : "⚠️"}</span>
              <span>{toast.text}</span>
            </div>
          )}

          {/* EXECUTIVE SUBHEADER & BREADCRUMB */}
          <div className="admin-executive-header">
            <div className="breadcrumb-line">
              <span>MAISON ATELIER</span> / <span>FULFILLMENT & ORDER LOGISTICS</span>
            </div>
            <div className="orders-header-title-row">
              <div>
                <h1 className="executive-title">Order Management</h1>
                <p className="admin-page-subtitle">
                  Inspect manifests, track luxury dispatches, reconcile payments, and manage returns.
                </p>
              </div>
              <div className="orders-header-actions">
                <button
                  type="button"
                  className="orders-refresh-button"
                  onClick={() => fetchOrders(page)}
                  disabled={loading}
                >
                  <span>↻</span>
                  <span>{loading ? "SYNCING..." : "SYNC MANIFESTS"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 1. ORDER STATISTICS KPI CARDS */}
          <section className="orders-kpi-grid">
            <div className="order-kpi-card highlight">
              <div className="kpi-icon-box">💰</div>
              <div className="kpi-info">
                <span className="kpi-label">RECOGNIZED REVENUE</span>
                <strong className="kpi-value">{formatINR(stats.recognizedRevenue)}</strong>
                <span className="kpi-hint">Net paid & delivered sales</span>
              </div>
            </div>

            <div className="order-kpi-card">
              <div className="kpi-icon-box">📦</div>
              <div className="kpi-info">
                <span className="kpi-label">TOTAL ORDERS</span>
                <strong className="kpi-value">{stats.totalOrders}</strong>
                <span className="kpi-hint">Historical manifests</span>
              </div>
            </div>

            <div className="order-kpi-card">
              <div className="kpi-icon-box" style={{ background: "rgba(234, 179, 8, 0.15)", color: "#eab308" }}>
                ⏳
              </div>
              <div className="kpi-info">
                <span className="kpi-label">PENDING CONFIRMATION</span>
                <strong className="kpi-value">{stats.pendingOrders}</strong>
                <span className="kpi-hint">Awaiting order triage</span>
              </div>
            </div>

            <div className="order-kpi-card">
              <div className="kpi-icon-box" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#a855f7" }}>
                ⚙️
              </div>
              <div className="kpi-info">
                <span className="kpi-label">PROCESSING</span>
                <strong className="kpi-value">{stats.processingOrders}</strong>
                <span className="kpi-hint">Atelier bottling & pack</span>
              </div>
            </div>

            <div className="order-kpi-card">
              <div className="kpi-icon-box" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
                ✈️
              </div>
              <div className="kpi-info">
                <span className="kpi-label">SHIPPED / IN TRANSIT</span>
                <strong className="kpi-value">{stats.shippedOrders}</strong>
                <span className="kpi-hint">Handed to carrier</span>
              </div>
            </div>

            <div className="order-kpi-card">
              <div className="kpi-icon-box" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e" }}>
                ✓
              </div>
              <div className="kpi-info">
                <span className="kpi-label">DELIVERED</span>
                <strong className="kpi-value">{stats.deliveredOrders}</strong>
                <span className="kpi-hint">Delivered to patron</span>
              </div>
            </div>

            <div className="order-kpi-card">
              <div className="kpi-icon-box" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                ✕
              </div>
              <div className="kpi-info">
                <span className="kpi-label">CANCELLED</span>
                <strong className="kpi-value">{stats.cancelledOrders}</strong>
                <span className="kpi-hint">Stock restored</span>
              </div>
            </div>

            <div className="order-kpi-card">
              <div className="kpi-icon-box" style={{ background: "rgba(129, 140, 248, 0.15)", color: "#818cf8" }}>
                🔄
              </div>
              <div className="kpi-info">
                <span className="kpi-label">RETURN REQUESTS</span>
                <strong className="kpi-value">{stats.returnRequests}</strong>
                <span className="kpi-hint">Pending inspection</span>
              </div>
            </div>
          </section>

          {/* 2. SEARCH & FILTERS TOOLBAR */}
          <section className="orders-toolbar-card">
            <form className="orders-search-row" onSubmit={handleSearchSubmit}>
              <div className="orders-search-input-group">
                <span className="input-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search by Order ID, Patron name, email, phone, or fragrance..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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
              <button type="submit" className="orders-apply-search-btn">
                SEARCH
              </button>
            </form>

            <div className="orders-filters-row">
              {/* Order Status Filter */}
              <div className="filter-dropdown-group">
                <label>ORDER STATUS</label>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => {
                    setOrderStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === "All" ? "All Order Statuses" : opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Status Filter */}
              <div className="filter-dropdown-group">
                <label>PAYMENT STATUS</label>
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => {
                    setPaymentStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  {PAYMENT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === "All" ? "All Payment Statuses" : opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method Filter */}
              <div className="filter-dropdown-group">
                <label>PAYMENT METHOD</label>
                <select
                  value={paymentMethodFilter}
                  onChange={(e) => {
                    setPaymentMethodFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === "All" ? "All Payment Methods" : opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Preset Filter */}
              <div className="filter-dropdown-group">
                <label>ORDER DATE</label>
                <select
                  value={datePreset}
                  onChange={(e) => {
                    setDatePreset(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="last7days">Last 7 Days</option>
                  <option value="thisMonth">This Month</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {/* Reset Filters Button */}
              <button
                type="button"
                className="orders-reset-filters-btn"
                onClick={handleClearFilters}
                title="Reset all filters to defaults"
              >
                CLEAR ALL
              </button>
            </div>

            {/* Custom Date Range Row */}
            {datePreset === "custom" && (
              <div className="custom-date-row">
                <div className="date-input-wrap">
                  <label>FROM:</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </div>
                <div className="date-input-wrap">
                  <label>TO:</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="apply-custom-date-btn"
                  onClick={() => setPage(1)}
                >
                  APPLY RANGE
                </button>
              </div>
            )}
          </section>

          {/* 3. ORDERS TABLE */}
          <section className="orders-table-card">
            <div className="admin-table-container">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>ORDER ID</th>
                    <th>DATE & TIME</th>
                    <th>PATRON</th>
                    <th style={{ textAlign: "center" }}>ITEMS</th>
                    <th>TOTAL</th>
                    <th>PAYMENT</th>
                    <th>FULFILLMENT STATUS</th>
                    <th style={{ textAlign: "center" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="table-loading-cell">
                        <div className="loading-spinner" />
                        <span>Querying atelier order records from vault...</span>
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="table-empty-cell">
                        <div className="empty-seal">📦</div>
                        <h3>No Orders Found</h3>
                        <p>No orders match your active search filters or date selection.</p>
                        <button
                          type="button"
                          className="orders-reset-filters-btn"
                          onClick={handleClearFilters}
                          style={{ margin: "12px auto 0 auto" }}
                        >
                          RESET FILTERS
                        </button>
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const totalUnits = (order.items || []).reduce(
                        (sum, it) => sum + (it.quantity || 1),
                        0
                      );

                      return (
                        <tr key={order._id || order.orderNumber}>
                          {/* Order Number */}
                          <td>
                            <div className="order-id-cell">
                              <strong className="order-code">{order.orderNumber}</strong>
                              {order.trackingInfo?.trackingNumber && (
                                <span className="order-sub-awb">
                                  AWB: {order.trackingInfo.trackingNumber}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Date */}
                          <td>
                            <div className="order-date-cell">
                              <span>{formatDate(order.createdAt)}</span>
                              <span className="order-time">
                                {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </td>

                          {/* Customer */}
                          <td>
                            <div className="order-customer-cell">
                              <strong className="customer-name">{order.customerName}</strong>
                              <span className="customer-email">{order.customerEmail}</span>
                              {order.shippingAddress?.city && (
                                <span className="customer-city">
                                  📍 {order.shippingAddress.city}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Items Count */}
                          <td style={{ textAlign: "center" }}>
                            <div className="order-items-count-badge">
                              {totalUnits} flacon{totalUnits > 1 ? "s" : ""}
                            </div>
                          </td>

                          {/* Order Total */}
                          <td>
                            <strong className="order-price-total">
                              {formatINR(order.totalAmount)}
                            </strong>
                          </td>

                          {/* Payment Method & Status */}
                          <td>
                            <div className="order-payment-cell">
                              <span className="payment-method-tag">
                                {order.paymentMethod === "COD"
                                  ? "Cash on Delivery"
                                  : order.paymentMethod}
                              </span>
                              <span
                                className={`payment-status-badge ${getPaymentBadgeClass(
                                  order.paymentStatus
                                )}`}
                              >
                                ● {order.paymentStatus}
                              </span>
                              {order.isFulfillmentBlocked && (
                                <span
                                  className="order-payment-warning-tag"
                                  title={order.paymentBlockReason || "Payment required before dispatch"}
                                >
                                  ⛔ Shipping Restricted
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Fulfillment Status */}
                          <td>
                            <span
                              className={`order-status-badge ${getStatusBadgeClass(
                                order.orderStatus
                              )}`}
                            >
                              ● {order.orderStatus}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "center", alignItems: "center" }}>
                              <button
                                type="button"
                                className="order-inspect-btn"
                                onClick={() => handleOpenOrderModal(order)}
                                title="Inspect order snapshot and manage status"
                              >
                                <span>🔍</span>
                                <span>Manage</span>
                              </button>
                              <button
                                type="button"
                                className="order-inspect-btn"
                                style={{ borderColor: "rgba(192, 132, 252, 0.4)", color: "#c084fc" }}
                                onClick={() => handleAdminDownloadPDF(order._id, order.orderNumber)}
                                disabled={downloadingPdfId === order._id}
                                title="Download PDF Tax Invoice"
                              >
                                <span>{downloadingPdfId === order._id ? "⌛" : "📄"}</span>
                                <span>{downloadingPdfId === order._id ? "..." : "PDF"}</span>
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

            {/* PAGINATION */}
            <AdminPagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalOrders}
              pageSize={10}
              itemName="orders"
              onPageChange={(p) => setPage(p)}
              variant="standalone"
            />
          </section>
        </main>
      </div>

      {/* 4. COMPLETE ORDER DETAILS & STATUS MANAGEMENT MODAL */}
      {isDetailModalOpen && (
        <div className="order-modal-backdrop" onClick={handleCloseOrderModal}>
          <div className="order-modal-container" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="modal-loading-box">
                <div className="loading-spinner" />
                <p>Retrieving authentic order manifest snapshot from database...</p>
              </div>
            ) : selectedOrder ? (
              <>
                {/* MODAL HEADER */}
                <div className="order-modal-header">
                  <div className="modal-header-titles">
                    <span className="modal-eyebrow">ORDER MANIFEST SNAPSHOT</span>
                    <h2>Manifest: {selectedOrder.orderNumber}</h2>
                    <span className="modal-date">
                      Placed on {formatDateTime(selectedOrder.createdAt)}
                    </span>
                  </div>
                  <div className="modal-header-right">
                    <button
                      type="button"
                      className="order-download-pdf-modal-btn"
                      onClick={() => handleAdminDownloadPDF(selectedOrder._id, selectedOrder.orderNumber)}
                      disabled={downloadingPdfId === selectedOrder._id}
                      title="Download Official Tax Invoice PDF"
                    >
                      <span>{downloadingPdfId === selectedOrder._id ? "⌛" : "📄"}</span>
                      <span>{downloadingPdfId === selectedOrder._id ? "Generating..." : "Download Invoice PDF"}</span>
                    </button>
                    <span
                      className={`order-status-badge ${getStatusBadgeClass(
                        selectedOrder.orderStatus
                      )}`}
                    >
                      ● {selectedOrder.orderStatus}
                    </span>
                    <button
                      type="button"
                      className="modal-close-btn"
                      onClick={handleCloseOrderModal}
                      aria-label="Close modal"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* MODAL BODY */}
                <div className="order-modal-body">
                  {/* FEEDBACK ALERT */}
                  {modalAlert && (
                    <div className={`modal-alert ${modalAlert.type}`}>
                      <span>{modalAlert.type === "success" ? "✓" : "⚠️"}</span>
                      <span>{modalAlert.message}</span>
                    </div>
                  )}

                  {/* TOP 3-PANEL META GRID */}
                  <div className="order-modal-meta-grid">
                    {/* Panel 1: Patron & Delivery Information */}
                    <div className="order-info-card">
                      <div className="info-card-header">
                        <span>👤</span>
                        <h4>Patron & Delivery Information</h4>
                      </div>
                      <div className="info-card-content">
                        <div className="info-row">
                          <span className="info-label">Customer Name:</span>
                          <strong>
                            {selectedOrder.shippingAddress?.fullName ||
                              selectedOrder.user?.name ||
                              "Patron"}
                          </strong>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Contact Email:</span>
                          <span>{selectedOrder.customerEmail}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Contact Phone:</span>
                          <span>{selectedOrder.customerPhone}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Destination Address:</span>
                          <span className="info-address">
                            {[
                              selectedOrder.shippingAddress?.house,
                              selectedOrder.shippingAddress?.street ||
                                selectedOrder.shippingAddress?.addressLine,
                              selectedOrder.shippingAddress?.city,
                              selectedOrder.shippingAddress?.state,
                              selectedOrder.shippingAddress?.pincode,
                              selectedOrder.shippingAddress?.country || "India",
                            ]
                              .filter(Boolean)
                              .join(", ") || "Saved Profile Address Snapshot"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Panel 2: Transaction & Ledger Details */}
                    <div className="order-info-card">
                      <div className="info-card-header">
                        <span>💳</span>
                        <h4>Transaction & Ledger Status</h4>
                      </div>
                      <div className="info-card-content">
                        <div className="info-row">
                          <span className="info-label">Payment Method:</span>
                          <strong>{selectedOrder.paymentMethod}</strong>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Payment Status:</span>
                          <span
                            className={`payment-status-badge ${getPaymentBadgeClass(
                              selectedOrder.paymentStatus
                            )}`}
                          >
                            ● {selectedOrder.paymentStatus}
                          </span>
                        </div>
                        {selectedOrder.razorpayPaymentId && (
                          <div className="info-row">
                            <span className="info-label">Razorpay Payment ID:</span>
                            <span className="monospace-code">
                              {selectedOrder.razorpayPaymentId}
                            </span>
                          </div>
                        )}
                        {selectedOrder.razorpayOrderId && (
                          <div className="info-row">
                            <span className="info-label">Razorpay Order ID:</span>
                            <span className="monospace-code">
                              {selectedOrder.razorpayOrderId}
                            </span>
                          </div>
                        )}
                        {selectedOrder.paymentFailureReason && (
                          <div className="info-row">
                            <span className="info-label">Failure Reason:</span>
                            <span style={{ color: "#f87171" }}>
                              {selectedOrder.paymentFailureReason}
                            </span>
                          </div>
                        )}

                        {/* Payment Status Reconcile form strictly for Cash on Delivery (COD) */}
                        {selectedOrder.paymentMethod === "COD" ? (
                          <form className="quick-payment-form" onSubmit={handlePaymentUpdate}>
                            <label>Reconcile COD Collection:</label>
                            <div className="inline-input-group">
                              <select
                                value={targetPaymentStatus}
                                onChange={(e) => setTargetPaymentStatus(e.target.value)}
                              >
                                <option value="Pending">Pending Collection</option>
                                <option value="Paid">Collected (Paid)</option>
                                <option value="Failed">Collection Failed</option>
                              </select>
                              <button
                                type="submit"
                                className="update-action-btn"
                                disabled={paymentUpdating}
                              >
                                {paymentUpdating ? "..." : "Save"}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="gateway-verified-note">
                            <span className="gateway-verified-title">🔒 Verified Online Payment</span>
                            <p>
                              Online payment status is verified automatically via gateway signatures. Manual status overrides are disabled to preserve financial audit integrity.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Panel 3: Status Transition Manager */}
                    <div className="order-info-card status-manager-card">
                      <div className="info-card-header">
                        <span>🔄</span>
                        <h4>Order Status Management</h4>
                      </div>
                      <div className="info-card-content">
                        <div className="info-row">
                          <span className="info-label">Current Status:</span>
                          <span
                            className={`order-status-badge ${getStatusBadgeClass(
                              selectedOrder.orderStatus
                            )}`}
                          >
                            ● {selectedOrder.orderStatus}
                          </span>
                        </div>

                        {/* Payment Restriction Notice if payment is failed or pending online */}
                        {selectedOrder.isFulfillmentBlocked && (
                          <div className="payment-blocked-warning-box">
                            <div className="warning-badge-header">
                              <span className="warning-icon">⛔</span>
                              <strong>SHIPPING RESTRICTED</strong>
                            </div>
                            <p>
                              {selectedOrder.paymentBlockReason ||
                                (selectedOrder.paymentStatus === "Failed"
                                  ? "Payment has failed. This order cannot be shipped or delivered until payment is successfully completed."
                                  : "Online payment is pending verification. This order cannot be shipped or delivered until payment is confirmed as Paid.")}
                            </p>
                          </div>
                        )}

                        {selectedOrder.allowedNextStatuses &&
                        selectedOrder.allowedNextStatuses.length > 0 ? (
                          <form className="status-transition-form" onSubmit={handleStatusUpdate}>
                            <label>Next Permitted Status:</label>
                            <select
                              value={targetStatus}
                              onChange={(e) => setTargetStatus(e.target.value)}
                              required
                            >
                              {selectedOrder.allowedNextStatuses.map((st) => (
                                <option key={st} value={st}>
                                  Transition to: {st}
                                </option>
                              ))}
                            </select>

                            <input
                              type="text"
                              placeholder="Optional audit trail note..."
                              value={adminStatusNote}
                              onChange={(e) => setAdminStatusNote(e.target.value)}
                            />

                            <button
                              type="submit"
                              className="confirm-transition-btn"
                              disabled={statusUpdating}
                            >
                              {statusUpdating ? "PROCESSING TRANSITION..." : "CONFIRM STATUS CHANGE"}
                            </button>
                          </form>
                        ) : (
                          <div className="terminal-status-notice payment-blocked">
                            <span>
                              {selectedOrder.isFulfillmentBlocked
                                ? "⛔ Fulfillment Restricted"
                                : "🔒 Terminal Order Lifecycle"}
                            </span>
                            <p>
                              {selectedOrder.isFulfillmentBlocked
                                ? (selectedOrder.paymentStatus === "Failed"
                                    ? "Cannot ship this order because payment has failed. Resolve the payment issue before proceeding."
                                    : "Cannot ship this order while online payment is pending verification.")
                                : `This order has reached its final lifecycle state (${selectedOrder.orderStatus}). No further forward transitions are permitted.`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SHIPMENT TRACKING MANAGEMENT ROW */}
                  <div className="tracking-manager-card">
                    <div className="tracking-header">
                      <span>🚚</span>
                      <h4>Shipment Logistics & Courier Tracking</h4>
                    </div>

                    {selectedOrder.isFulfillmentBlocked ? (
                      <div className="tracking-blocked-banner">
                        <span>⚠️ Courier dispatch and shipment tracking registration is disabled while payment is failed or unverified online.</span>
                      </div>
                    ) : (
                      <form className="tracking-form-grid" onSubmit={handleTrackingUpdate}>
                        <div className="tracking-input-group">
                          <label>COURIER / CARRIER</label>
                          <input
                            type="text"
                            list="carrier-suggestions"
                            placeholder="e.g. Blue Dart, Delhivery"
                            value={trackingCourier}
                            onChange={(e) => setTrackingCourier(e.target.value)}
                          />
                          <datalist id="carrier-suggestions">
                            {COURIER_PROVIDERS.map((c) => (
                              <option key={c} value={c} />
                            ))}
                          </datalist>
                        </div>

                        <div className="tracking-input-group">
                          <label>TRACKING NUMBER / AWB</label>
                          <input
                            type="text"
                            placeholder="e.g. BLU-9821872198"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                          />
                        </div>

                        <div className="tracking-input-group full-width">
                          <label>TRACKING URL (OPTIONAL)</label>
                          <input
                            type="url"
                            placeholder="https://track.carrier.com/..."
                            value={trackingUrl}
                            onChange={(e) => setTrackingUrl(e.target.value)}
                          />
                        </div>

                        <button
                          type="submit"
                          className="save-tracking-btn"
                          disabled={trackingUpdating}
                        >
                          {trackingUpdating ? "SAVING AWB..." : "PUBLISH TRACKING INFO"}
                        </button>
                      </form>
                    )}
                  </div>

                  {/* FINANCIAL BREAKDOWN STRIP */}
                  <div className="order-financials-strip">
                    <div className="fin-metric">
                      <span>Subtotal</span>
                      <strong>{formatINR(selectedOrder.subtotal)}</strong>
                    </div>
                    <div className="fin-metric">
                      <span>Offer Discount</span>
                      <strong className="discount">
                        {selectedOrder.totalOfferDiscount > 0
                          ? `-${formatINR(selectedOrder.totalOfferDiscount)}`
                          : "₹0"}
                      </strong>
                    </div>
                    <div className="fin-metric">
                      <span>Coupon ({selectedOrder.couponCode || "None"})</span>
                      <strong className="discount">
                        {selectedOrder.discountAmount > 0
                          ? `-${formatINR(selectedOrder.discountAmount)}`
                          : "₹0"}
                      </strong>
                    </div>
                    <div className="fin-metric">
                      <span>Shipping</span>
                      <strong>
                        {selectedOrder.shippingCost === 0
                          ? "Complimentary"
                          : formatINR(selectedOrder.shippingCost)}
                      </strong>
                    </div>
                    <div className="fin-metric total">
                      <span>Order Total</span>
                      <strong className="total-amount">
                        {formatINR(selectedOrder.totalAmount)}
                      </strong>
                    </div>
                    <div className="fin-metric refunded">
                      <span>Refunded Amount</span>
                      <strong className="refund-amount">
                        {formatINR(selectedOrder.totalRefundedAmount || 0)}
                      </strong>
                    </div>
                  </div>

                  {/* ORDERED FRAGRANCE ITEMS TABLE */}
                  <div className="modal-items-section">
                    <h3>Ordered Fragrances & Stored Snapshot Allocations</h3>
                    <div className="admin-table-container">
                      <table className="modal-items-table">
                        <thead>
                          <tr>
                            <th>PRODUCT</th>
                            <th>VOLUME</th>
                            <th style={{ textAlign: "center" }}>QTY</th>
                            <th>UNIT PRICE</th>
                            <th>OFFER DISC</th>
                            <th>COUPON DISC</th>
                            <th>FINAL NET TOTAL</th>
                            <th>STATUS</th>
                            <th style={{ textAlign: "center" }}>RETURN REVIEW</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrder.items && selectedOrder.items.length > 0 ? (
                            selectedOrder.items.map((it) => {
                              const isReturnRequested = it.itemStatus === "Return Requested";

                              return (
                                <tr key={it._id || it.variantId}>
                                  <td>
                                    <div className="item-name-cell">
                                      <strong className="item-name">{it.name}</strong>
                                      <span className="item-brand">{it.brand || "FEXA"}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="volume-badge">💧 {it.volumeMl} ml</span>
                                  </td>
                                  <td style={{ textAlign: "center" }}>
                                    <strong>{it.quantity}</strong>
                                  </td>
                                  <td>{formatINR(it.unitPrice)}</td>
                                  <td>
                                    {it.offerDiscount > 0 ? (
                                      <span className="discount-text">
                                        -{formatINR(it.offerDiscount)}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td>
                                    {it.allocatedCouponDiscount > 0 ? (
                                      <span className="discount-text">
                                        -{formatINR(it.allocatedCouponDiscount)}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td>
                                    <strong>
                                      {formatINR(
                                        it.discountedLineAmount !== null &&
                                          it.discountedLineAmount !== undefined
                                          ? it.discountedLineAmount
                                          : it.lineTotal - (it.allocatedCouponDiscount || 0)
                                      )}
                                    </strong>
                                  </td>
                                  <td>
                                    <span className="item-status-tag">
                                      {it.itemStatus || "Active"}
                                      {it.returnedQuantity > 0 && ` (${it.returnedQuantity} ret)`}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: "center" }}>
                                    {isReturnRequested ? (
                                      <div className="return-actions-row">
                                        <button
                                          type="button"
                                          className="approve-return-btn"
                                          onClick={() => handleApproveItemReturn(it._id)}
                                          disabled={returnProcessingId === it._id}
                                        >
                                          ✓ Approve
                                        </button>
                                        <button
                                          type="button"
                                          className="reject-return-btn"
                                          onClick={() => handleRejectItemReturn(it._id)}
                                          disabled={returnProcessingId === it._id}
                                        >
                                          ✕ Reject
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="no-action-dash">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan="9" style={{ textAlign: "center", padding: "20px" }}>
                                No items recorded in this snapshot.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* STATUS AUDIT TRAIL / HISTORY */}
                  {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
                    <div className="modal-audit-trail-section">
                      <h3>Audit Trail & Status Progression History</h3>
                      <div className="audit-timeline">
                        {selectedOrder.statusHistory.map((entry, idx) => (
                          <div key={idx} className="audit-step">
                            <div className="audit-marker">●</div>
                            <div className="audit-content">
                              <div className="audit-top-row">
                                <span className="audit-transition">
                                  {entry.previousStatus ? `${entry.previousStatus} → ` : ""}
                                  <strong>{entry.newStatus}</strong>
                                </span>
                                <span className="audit-time">
                                  {formatDateTime(entry.timestamp)}
                                </span>
                              </div>
                              <p className="audit-note">{entry.note || "System update"}</p>
                              <span className="audit-actor">
                                By: {entry.adminEmail || "Atelier Administration"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
