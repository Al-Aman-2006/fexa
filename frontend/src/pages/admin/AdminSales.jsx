import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAdminAuth } from "../../context/AdminAuthContext";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminPagination from "../../components/admin/AdminPagination";
import "./AdminDashboard.css";
import "./AdminSales.css";

function AdminSales() {
  const { admin, logoutAdmin } = useAdminAuth();

  // Sidebar state
  const [activeTab, setActiveTab] = useState("sales");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Date Filter State
  const [period, setPeriod] = useState("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustomRange, setShowCustomRange] = useState(false);

  // Data States
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [trendsInterval, setTrendsInterval] = useState("daily");
  const [chartMetric, setChartMetric] = useState("revenue"); // "revenue" | "orders"
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const [categories, setCategories] = useState([]);
  const [payments, setPayments] = useState(null);
  const [coupons, setCoupons] = useState([]);

  // Products Table State
  const [products, setProducts] = useState([]);
  const [productSortBy, setProductSortBy] = useState("unitsSold");
  const [productSortOrder, setProductSortOrder] = useState("desc");
  const [productPage, setProductPage] = useState(1);
  const [productPagination, setProductPagination] = useState({ page: 1, totalPages: 1, totalVariants: 0 });

  // Detailed Report Table State
  const [orders, setOrders] = useState([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [appliedOrderSearch, setAppliedOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("All");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("All");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("All");
  const [orderSortBy, setOrderSortBy] = useState("createdAt");
  const [orderSortOrder, setOrderSortOrder] = useState("desc");
  const [orderPage, setOrderPage] = useState(1);
  const [orderPagination, setOrderPagination] = useState({ page: 1, totalPages: 1, totalOrders: 0 });

  // Order Inspection & Return Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [modalProcessing, setModalProcessing] = useState(false);
  const [modalAlert, setModalAlert] = useState(null);
  const [returnQtyMap, setReturnQtyMap] = useState({});

  // Status & Loading States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

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

  // Base Query Params for currently selected period
  const getPeriodParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("period", period);
    if (period === "custom") {
      if (customStart) params.set("startDate", customStart);
      if (customEnd) params.set("endDate", customEnd);
    }
    return params;
  }, [period, customStart, customEnd]);

  // Fetch High-Level Analytics (Overview, Trends, Categories, Payments, Coupons)
  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = getPeriodParams().toString();

      const [resOverview, resTrends, resCats, resPays, resCoupons] = await Promise.all([
        fetch(`http://localhost:5000/api/admin/sales/overview?${params}`, { credentials: "include" }),
        fetch(`http://localhost:5000/api/admin/sales/trends?${params}`, { credentials: "include" }),
        fetch(`http://localhost:5000/api/admin/sales/categories?${params}`, { credentials: "include" }),
        fetch(`http://localhost:5000/api/admin/sales/payments?${params}`, { credentials: "include" }),
        fetch(`http://localhost:5000/api/admin/sales/coupons?${params}`, { credentials: "include" }),
      ]);

      const [dataOverview, dataTrends, dataCats, dataPays, dataCoupons] = await Promise.all([
        resOverview.json(),
        resTrends.json(),
        resCats.json(),
        resPays.json(),
        resCoupons.json(),
      ]);

      if (dataOverview.success) setOverview(dataOverview.data);
      if (dataTrends.success) {
        setTrends(dataTrends.data.series || []);
        setTrendsInterval(dataTrends.data.interval);
      }
      if (dataCats.success) setCategories(dataCats.data.categories || []);
      if (dataPays.success) setPayments(dataPays.data.methods || null);
      if (dataCoupons.success) setCoupons(dataCoupons.data.coupons || []);
    } catch (err) {
      console.error("Fetch sales analytics error:", err);
      setError("Unable to load sales analytics. Please check server connection.");
    } finally {
      setLoading(false);
    }
  }, [getPeriodParams]);

  // Fetch Product Performance Table
  const fetchProductData = useCallback(async () => {
    try {
      const params = getPeriodParams();
      params.set("page", productPage);
      params.set("limit", 10);
      params.set("sortBy", productSortBy);
      params.set("sortOrder", productSortOrder);

      const res = await fetch(`http://localhost:5000/api/admin/sales/products?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setProducts(data.data.products || []);
        setProductPagination(data.data.pagination);
      }
    } catch (err) {
      console.error("Fetch product performance error:", err);
    }
  }, [getPeriodParams, productPage, productSortBy, productSortOrder]);

  // Fetch Detailed Orders Table
  const fetchOrdersData = useCallback(async () => {
    try {
      const params = getPeriodParams();
      params.set("page", orderPage);
      params.set("limit", 10);
      params.set("sortBy", orderSortBy);
      params.set("sortOrder", orderSortOrder);

      if (appliedOrderSearch.trim()) params.set("search", appliedOrderSearch.trim());
      if (orderStatusFilter !== "All") params.set("orderStatus", orderStatusFilter);
      if (paymentStatusFilter !== "All") params.set("paymentStatus", paymentStatusFilter);
      if (paymentMethodFilter !== "All") params.set("paymentMethod", paymentMethodFilter);

      const res = await fetch(`http://localhost:5000/api/admin/sales/report?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setOrders(data.data.orders || []);
        setOrderPagination(data.data.pagination);
      }
    } catch (err) {
      console.error("Fetch detailed orders error:", err);
    }
  }, [
    getPeriodParams,
    orderPage,
    orderSortBy,
    orderSortOrder,
    appliedOrderSearch,
    orderStatusFilter,
    paymentStatusFilter,
    paymentMethodFilter,
  ]);

  // Main lifecycle: load data on period change
  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  useEffect(() => {
    fetchProductData();
  }, [fetchProductData]);

  useEffect(() => {
    fetchOrdersData();
  }, [fetchOrdersData]);

  // Handle Preset Period Selection
  const handleSelectPeriod = (preset) => {
    if (preset === "custom") {
      setShowCustomRange(true);
      setPeriod("custom");
    } else {
      setShowCustomRange(false);
      setPeriod(preset);
      setProductPage(1);
      setOrderPage(1);
    }
  };

  // Handle Custom Range Apply
  const handleApplyCustomRange = (e) => {
    e.preventDefault();
    if (!customStart || !customEnd) return;
    setPeriod("custom");
    setProductPage(1);
    setOrderPage(1);
    fetchAnalyticsData();
  };

  // Handle CSV Export
  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const params = getPeriodParams();
      if (orderStatusFilter !== "All") params.set("orderStatus", orderStatusFilter);
      if (paymentStatusFilter !== "All") params.set("paymentStatus", paymentStatusFilter);
      if (paymentMethodFilter !== "All") params.set("paymentMethod", paymentMethodFilter);
      if (appliedOrderSearch.trim()) params.set("search", appliedOrderSearch.trim());

      const url = `http://localhost:5000/api/admin/sales/export?${params.toString()}`;
      const response = await fetch(url, { credentials: "include" });

      if (!response.ok) {
        throw new Error("Export failed on server.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `FEXA_Sales_Report_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export sales report. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Order Details Modal & Return Processing Handlers
  const handleOpenOrderModal = async (order) => {
    setSelectedOrder(order);
    setIsOrderModalOpen(true);
    setModalAlert(null);
    try {
      const res = await fetch(`http://localhost:5000/api/admin/sales/orders/${order._id}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success && data.order) {
        setSelectedOrder(data.order);
      }
    } catch (err) {
      console.error("Fetch full order details error:", err);
    }
  };

  const handleCloseOrderModal = () => {
    setIsOrderModalOpen(false);
    setSelectedOrder(null);
    setModalAlert(null);
  };

  const handleApproveReturn = async (itemId, returnQty) => {
    if (!selectedOrder) return;
    try {
      setModalProcessing(true);
      setModalAlert(null);

      const res = await fetch(
        `http://localhost:5000/api/admin/sales/orders/${selectedOrder._id}/items/${itemId}/approve-return`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: returnQty }),
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        setModalAlert({ type: "success", message: data.message });
        if (data.order) setSelectedOrder(data.order);
        fetchOrdersData();
        fetchAnalyticsData();
      } else {
        setModalAlert({ type: "error", message: data.message || "Failed to approve return." });
      }
    } catch (err) {
      console.error("Approve return error:", err);
      setModalAlert({ type: "error", message: "Network error approving return." });
    } finally {
      setModalProcessing(false);
    }
  };

  const handleRejectReturn = async (itemId, reason) => {
    if (!selectedOrder) return;
    try {
      setModalProcessing(true);
      setModalAlert(null);

      const res = await fetch(
        `http://localhost:5000/api/admin/sales/orders/${selectedOrder._id}/items/${itemId}/reject-return`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        setModalAlert({ type: "success", message: data.message });
        if (data.order) setSelectedOrder(data.order);
        fetchOrdersData();
      } else {
        setModalAlert({ type: "error", message: data.message || "Failed to reject return." });
      }
    } catch (err) {
      console.error("Reject return error:", err);
      setModalAlert({ type: "error", message: "Network error rejecting return." });
    } finally {
      setModalProcessing(false);
    }
  };

  // Sort Handlers
  const handleToggleProductSort = (field) => {
    if (productSortBy === field) {
      setProductSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setProductSortBy(field);
      setProductSortOrder("desc");
    }
    setProductPage(1);
  };

  const handleToggleOrderSort = (field) => {
    if (orderSortBy === field) {
      setOrderSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setOrderSortBy(field);
      setOrderSortOrder("desc");
    }
    setOrderPage(1);
  };

  // Search Submission
  const handleOrderSearchSubmit = (e) => {
    e.preventDefault();
    setOrderPage(1);
    setAppliedOrderSearch(orderSearch);
  };

  const handleClearOrderSearch = () => {
    setOrderSearch("");
    setAppliedOrderSearch("");
    setOrderPage(1);
  };

  // SVG Chart Calculation
  const chartCoordinates = useMemo(() => {
    if (!trends || trends.length === 0) return { points: [], pathD: "", areaD: "", maxVal: 0 };

    const svgWidth = 800;
    const svgHeight = 220;
    const paddingX = 40;
    const paddingY = 30;

    const values = trends.map((t) => (chartMetric === "revenue" ? t.revenue : t.orderCount));
    const maxVal = Math.max(...values, chartMetric === "revenue" ? 1000 : 5);

    const stepX = trends.length > 1 ? (svgWidth - paddingX * 2) / (trends.length - 1) : 0;

    const points = trends.map((t, idx) => {
      const val = chartMetric === "revenue" ? t.revenue : t.orderCount;
      const x = trends.length === 1 ? svgWidth / 2 : paddingX + idx * stepX;
      const y = svgHeight - paddingY - (val / maxVal) * (svgHeight - paddingY * 2);
      return { x, y, val, label: t.label, raw: t };
    });

    const pathD = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "");
    const areaD = `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${
      svgHeight - paddingY
    } Z`;

    return { points, pathD, areaD, maxVal };
  }, [trends, chartMetric]);

  const kpis = overview?.overview;

  return (
    <div className="admin-dashboard-page">
      {/* PERMANENT ADMIN SIDEBAR */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={logoutAdmin}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      {/* MAIN CONTAINER */}
      <div className="admin-main-wrapper">
        {/* EXECUTIVE COMMAND TOP BAR */}
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
                placeholder="Search orders, SKU, or customers... (⌘K)"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleOrderSearchSubmit(e);
                }}
              />
            </div>
          </div>

          <div className="command-bar-right">
            <button className="command-btn telemetry-btn">
              <span>📈</span> SALES TELEMETRY
            </button>
            <button className="command-btn batch-btn" onClick={handleExportCSV} disabled={exporting}>
              <span>⬇</span> {exporting ? "EXPORTING..." : "EXPORT CSV REPORT"}
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

        {/* MAIN SALES CONTENT AREA */}
        <main className="admin-sales-container">
          {/* EXECUTIVE SUBHEADER & BREADCRUMB */}
          <div className="admin-executive-header">
            <div className="breadcrumb-line">
              <span>MAISON ATELIER</span> / <span>FINANCIAL AUDIT & REPORTING</span>
            </div>
            <h1 className="executive-title">Sales Management</h1>
            <p style={{ color: "#a184bd", fontSize: "12px", margin: "4px 0 0 0" }}>
              Monitor revenue, analyze product performance, and track sales activity.
            </p>
          </div>

          {/* ERROR BANNER */}
          {error && (
            <div className="sales-error-banner">
              <span>⚠️ {error}</span>
              <button className="retry-btn" onClick={fetchAnalyticsData}>
                RETRY
              </button>
            </div>
          )}

          {/* DATE FILTERS TOOLBAR CARD */}
          <section className="sales-toolbar-card">
            <div className="sales-filters-group">
              {[
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "last7days", label: "Last 7 Days" },
                { id: "last30days", label: "Last 30 Days" },
                { id: "thisMonth", label: "This Month" },
                { id: "prevMonth", label: "Previous Month" },
                { id: "thisYear", label: "This Year" },
                { id: "custom", label: "Custom Range" },
              ].map((filterItem) => (
                <button
                  key={filterItem.id}
                  className={`date-preset-btn ${period === filterItem.id ? "active" : ""}`}
                  onClick={() => handleSelectPeriod(filterItem.id)}
                >
                  {filterItem.label}
                </button>
              ))}
            </div>

            <div className="sales-actions-group">
              <div className="active-range-badge">
                <span>🗓️</span>
                <span>{overview?.periodLabel || "Selected Window"}</span>
              </div>

              <button className="export-csv-btn" onClick={handleExportCSV} disabled={exporting}>
                <span>📥</span>
                <span>{exporting ? "GENERATING..." : "EXPORT CSV"}</span>
              </button>
            </div>

            {/* CUSTOM RANGE PICKER ROW */}
            {showCustomRange && (
              <form className="custom-range-picker-row" onSubmit={handleApplyCustomRange}>
                <div className="range-input-group">
                  <span>FROM:</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    required
                  />
                </div>
                <div className="range-input-group">
                  <span>TO:</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="apply-range-btn">
                  APPLY RANGE
                </button>
              </form>
            )}
          </section>

          {/* 1. SALES OVERVIEW CARDS */}
          {loading && !overview ? (
            <div className="sales-loading-box">
              <span>Synthesizing atelier ledger snapshots & verified revenue...</span>
            </div>
          ) : (
            <section className="sales-kpi-grid">
              {/* Total Sales Revenue */}
              <div className="sales-kpi-card highlight">
                <div className="kpi-header">
                  <span className="kpi-label">TOTAL SALES REVENUE</span>
                  <span className="kpi-icon">💰</span>
                </div>
                <div className="kpi-value">{formatINR(kpis?.recognizedRevenue || 0)}</div>
                <div className="kpi-subtext">
                  {kpis?.growth?.revenueGrowth !== null && kpis?.growth?.revenueGrowth !== undefined ? (
                    <span
                      className={`growth-badge ${
                        kpis.growth.revenueGrowth > 0
                          ? "positive"
                          : kpis.growth.revenueGrowth < 0
                          ? "negative"
                          : "neutral"
                      }`}
                    >
                      {kpis.growth.revenueGrowth > 0 ? "▲ +" : kpis.growth.revenueGrowth < 0 ? "▼ " : ""}
                      {kpis.growth.revenueGrowth}%
                    </span>
                  ) : (
                    <span className="growth-badge neutral">Baseline</span>
                  )}
                  <span>vs preceding equivalent window</span>
                </div>
              </div>

              {/* Total Orders */}
              <div className="sales-kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">TOTAL ELIGIBLE ORDERS</span>
                  <span className="kpi-icon">📦</span>
                </div>
                <div className="kpi-value">{kpis?.totalOrders || 0}</div>
                <div className="kpi-subtext">
                  {kpis?.growth?.ordersGrowth !== null && kpis?.growth?.ordersGrowth !== undefined ? (
                    <span
                      className={`growth-badge ${
                        kpis.growth.ordersGrowth > 0
                          ? "positive"
                          : kpis.growth.ordersGrowth < 0
                          ? "negative"
                          : "neutral"
                      }`}
                    >
                      {kpis.growth.ordersGrowth > 0 ? "▲ +" : kpis.growth.ordersGrowth < 0 ? "▼ " : ""}
                      {kpis.growth.ordersGrowth}%
                    </span>
                  ) : (
                    <span className="growth-badge neutral">Baseline</span>
                  )}
                  <span>active fulfillment records</span>
                </div>
              </div>

              {/* Units Sold */}
              <div className="sales-kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">PERFUME UNITS SOLD</span>
                  <span className="kpi-icon">🧪</span>
                </div>
                <div className="kpi-value">{kpis?.unitsSold || 0}</div>
                <div className="kpi-subtext">
                  <span>Across 30ml, 50ml, 100ml, 200ml bottles</span>
                </div>
              </div>

              {/* Average Order Value (AOV) */}
              <div className="sales-kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">AVERAGE ORDER VALUE</span>
                  <span className="kpi-icon">📊</span>
                </div>
                <div className="kpi-value">{formatINR(kpis?.averageOrderValue || 0)}</div>
                <div className="kpi-subtext">
                  <span>Revenue per verified customer purchase</span>
                </div>
              </div>

              {/* Successful Payments */}
              <div className="sales-kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">SUCCESSFUL PAYMENTS</span>
                  <span className="kpi-icon">✅</span>
                </div>
                <div className="kpi-value">{formatINR(kpis?.successfulPayments?.amount || 0)}</div>
                <div className="kpi-subtext">
                  <span>{kpis?.successfulPayments?.count || 0} verified online captures</span>
                </div>
              </div>

              {/* Pending Payments */}
              <div className="sales-kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">PENDING / IN-TRANSIT</span>
                  <span className="kpi-icon">⏳</span>
                </div>
                <div className="kpi-value">{formatINR(kpis?.pendingPayments?.amount || 0)}</div>
                <div className="kpi-subtext">
                  <span>{kpis?.pendingPayments?.count || 0} awaiting delivery / payment</span>
                </div>
              </div>

              {/* Coupon Discounts */}
              <div className="sales-kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">COUPON DISCOUNTS</span>
                  <span className="kpi-icon">🎟️</span>
                </div>
                <div className="kpi-value">{formatINR(kpis?.coupons?.totalDiscountAmount || 0)}</div>
                <div className="kpi-subtext">
                  <span>{kpis?.coupons?.redemptionsCount || 0} privilege codes redeemed</span>
                </div>
              </div>

              {/* Cancelled & Failed Orders */}
              <div className="sales-kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">CANCELLED / FAILED</span>
                  <span className="kpi-icon">❌</span>
                </div>
                <div className="kpi-value">{formatINR(kpis?.failedPayments?.amount || 0)}</div>
                <div className="kpi-subtext">
                  <span>
                    {kpis?.failedPayments?.count || 0} failed / {kpis?.cancelledOrders?.count || 0} cancelled
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* 2. SALES TRENDS CHART */}
          <section className="sales-section-card">
            <div className="section-head-row">
              <div className="section-title-wrap">
                <h3>
                  <span>📈</span>
                  <span>Sales Trends ({trendsInterval === "monthly" ? "Monthly" : "Daily"})</span>
                </h3>
                <p>Recognized revenue trajectory and order volume progression across the selected timeframe.</p>
              </div>

              <div className="chart-toggle-group">
                <button
                  className={`chart-toggle-btn ${chartMetric === "revenue" ? "active" : ""}`}
                  onClick={() => setChartMetric("revenue")}
                >
                  REVENUE (₹)
                </button>
                <button
                  className={`chart-toggle-btn ${chartMetric === "orders" ? "active" : ""}`}
                  onClick={() => setChartMetric("orders")}
                >
                  ORDER COUNT
                </button>
              </div>
            </div>

            <div className="sales-chart-wrapper">
              {trends.length === 0 ? (
                <div className="sales-empty-box">No recorded order activity in this date interval.</div>
              ) : (
                <>
                  <svg className="svg-chart" viewBox="0 0 800 220" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="lavenderGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#a184bd" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#a184bd" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="strokeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#7c5c99" />
                        <stop offset="50%" stopColor="#a184bd" />
                        <stop offset="100%" stopColor="#d4c1e6" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    <line x1="40" y1="30" x2="760" y2="30" stroke="rgba(161, 132, 189, 0.12)" strokeDasharray="3 3" />
                    <line x1="40" y1="110" x2="760" y2="110" stroke="rgba(161, 132, 189, 0.12)" strokeDasharray="3 3" />
                    <line x1="40" y1="190" x2="760" y2="190" stroke="rgba(161, 132, 189, 0.2)" />

                    {/* Area fill */}
                    {chartCoordinates.areaD && <path d={chartCoordinates.areaD} fill="url(#lavenderGlow)" />}

                    {/* Main stroke line */}
                    {chartCoordinates.pathD && (
                      <path
                        d={chartCoordinates.pathD}
                        fill="none"
                        stroke="url(#strokeGradient)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Interactive points */}
                    {chartCoordinates.points.map((pt, i) => (
                      <g key={i}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={hoveredPoint?.raw?.key === pt.raw.key ? "5.5" : "3.5"}
                          fill="#ffffff"
                          stroke="#7c5c99"
                          strokeWidth="2"
                          style={{ cursor: "pointer", transition: "r 0.15s" }}
                          onMouseEnter={() => setHoveredPoint(pt)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      </g>
                    ))}
                  </svg>

                  {/* Tooltip Overlay */}
                  {hoveredPoint && (
                    <div
                      className="chart-tooltip"
                      style={{
                        left: `${(hoveredPoint.x / 800) * 100}%`,
                        top: `${(hoveredPoint.y / 220) * 100}%`,
                      }}
                    >
                      <div className="chart-tooltip-date">{hoveredPoint.label}</div>
                      <div className="chart-tooltip-metric">
                        {chartMetric === "revenue"
                          ? formatINR(hoveredPoint.raw.revenue)
                          : `${hoveredPoint.raw.orderCount} Orders`}
                      </div>
                      <div style={{ fontSize: "10px", color: "#a184bd", marginTop: "2px" }}>
                        {chartMetric === "revenue"
                          ? `${hoveredPoint.raw.orderCount} Orders recorded`
                          : `${formatINR(hoveredPoint.raw.revenue)} recognized`}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* 3. CATEGORY PERFORMANCE BREAKDOWN */}
          <section className="sales-section-card">
            <div className="section-head-row">
              <div className="section-title-wrap">
                <h3>
                  <span>⚗️</span>
                  <span>Category Sales Performance</span>
                </h3>
                <p>Perfume collection metrics across Men, Women, and Unisex categories without double-counting.</p>
              </div>
            </div>

            <div className="category-cards-grid">
              {categories.map((cat) => (
                <div key={cat.category} className="category-stat-card">
                  <div className="cat-head">
                    <span className="cat-name">{cat.category} Collection</span>
                    <span className="cat-share-pill">{cat.sharePercentage}% Share</span>
                  </div>

                  <div className="cat-metrics-row">
                    <span className="cat-sales-val">{formatINR(cat.grossSales)}</span>
                    <span className="cat-units-val">
                      {cat.unitsSold} Units • {cat.ordersCount} Orders
                    </span>
                  </div>

                  <div className="cat-progress-bar-wrap">
                    <div className="cat-progress-bar-fill" style={{ width: `${cat.sharePercentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4. PAYMENT METHODS BREAKDOWN */}
          {payments && (
            <section className="sales-section-card">
              <div className="section-head-row">
                <div className="section-title-wrap">
                  <h3>
                    <span>💳</span>
                    <span>Payment Methods Distribution</span>
                  </h3>
                  <p>Segregation of verified Razorpay settlements from COD placed and delivered orders.</p>
                </div>
              </div>

              <div className="payment-methods-grid">
                <div className="payment-method-card">
                  <span className="pm-label">
                    <span>⚡</span> RAZORPAY VERIFIED
                  </span>
                  <span className="pm-amount">{formatINR(payments.razorpayPaid.amount)}</span>
                  <span className="pm-count">{payments.razorpayPaid.count} Verified Orders</span>
                </div>

                <div className="payment-method-card">
                  <span className="pm-label">
                    <span>📬</span> COD DELIVERED / COLLECTED
                  </span>
                  <span className="pm-amount">{formatINR(payments.codDelivered.amount)}</span>
                  <span className="pm-count">{payments.codDelivered.count} Fulfilled Deliveries</span>
                </div>

                <div className="payment-method-card">
                  <span className="pm-label">
                    <span>🚚</span> COD IN-TRANSIT (PENDING)
                  </span>
                  <span className="pm-amount">{formatINR(payments.codInTransit.amount)}</span>
                  <span className="pm-count">{payments.codInTransit.count} Orders In Progress</span>
                </div>

                <div className="payment-method-card">
                  <span className="pm-label">
                    <span>⏳</span> RAZORPAY INCOMPLETE
                  </span>
                  <span className="pm-amount">{formatINR(payments.razorpayPending.amount)}</span>
                  <span className="pm-count">{payments.razorpayPending.count} Pending Checkouts</span>
                </div>

                <div className="payment-method-card">
                  <span className="pm-label">
                    <span>⚠️</span> FAILED PAYMENT ATTEMPTS
                  </span>
                  <span className="pm-amount">{formatINR(payments.razorpayFailed.amount)}</span>
                  <span className="pm-count">{payments.razorpayFailed.count} Dismissed / Declined</span>
                </div>
              </div>
            </section>
          )}

          {/* 5. COUPON & PRIVILEGE CODES REPORT */}
          {coupons.length > 0 && (
            <section className="sales-section-card">
              <div className="section-head-row">
                <div className="section-title-wrap">
                  <h3>
                    <span>🎟️</span>
                    <span>Coupon & Discount Analytics</span>
                  </h3>
                  <p>Redemption volume, discount totals, and gross merchandise generated per active promotion.</p>
                </div>
              </div>

              <div className="sales-data-table-wrap">
                <table className="sales-data-table">
                  <thead>
                    <tr>
                      <th>COUPON CODE</th>
                      <th>PROMOTION TITLE</th>
                      <th>DISCOUNT VALUE</th>
                      <th>REDEMPTIONS</th>
                      <th>TOTAL DISCOUNT GRANTED</th>
                      <th>MERCHANDISE GENERATED</th>
                      <th>NET REVENUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((c) => (
                      <tr key={c.code}>
                        <td>
                          <span className="order-num-pill" style={{ color: "#d4c1e6" }}>
                            🎟️ {c.code}
                          </span>
                        </td>
                        <td>{c.name}</td>
                        <td>
                          <span className="variant-pill">{c.discountPercentage}% OFF</span>
                        </td>
                        <td>{c.redemptionsCount} orders</td>
                        <td style={{ color: "#ff858d", fontWeight: 700 }}>
                          -{formatINR(c.totalDiscountGranted)}
                        </td>
                        <td>{formatINR(c.associatedGrossSales)}</td>
                        <td style={{ fontWeight: 700, color: "#ffffff" }}>
                          {formatINR(c.associatedFinalRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 6. PRODUCT PERFORMANCE (VARIANT-LEVEL REPORTING) */}
          <section className="sales-table-card">
            <div className="section-head-row">
              <div className="section-title-wrap">
                <h3>
                  <span>🧪</span>
                  <span>Product Sales & Variant Performance</span>
                </h3>
                <p>Perfume bottle variant tracking across 30ml, 50ml, 100ml, and 200ml sizes.</p>
              </div>
            </div>

            <div className="sales-data-table-wrap">
              <table className="sales-data-table">
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>CATEGORY</th>
                    <th>BOTTLE SIZE</th>
                    <th className="sortable" onClick={() => handleToggleProductSort("unitsSold")}>
                      UNITS SOLD {productSortBy === "unitsSold" ? (productSortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th>ORDER FREQUENCY</th>
                    <th className="sortable" onClick={() => handleToggleProductSort("grossSales")}>
                      GROSS SALES {productSortBy === "grossSales" ? (productSortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="sortable" onClick={() => handleToggleProductSort("netSales")}>
                      NET REVENUE {productSortBy === "netSales" ? (productSortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="sales-empty-box">
                        No product sales recorded in the selected period.
                      </td>
                    </tr>
                  ) : (
                    products.map((p, idx) => (
                      <tr key={`${p.name}-${p.volumeMl}-${idx}`}>
                        <td>
                          <div className="product-cell">
                            {p.image ? (
                              <img
                                src={p.image.startsWith("http") ? p.image : `http://localhost:5000${p.image}`}
                                alt={p.name}
                                className="product-thumb"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="product-thumb" style={{ display: "grid", placeItems: "center" }}>
                                ⚗️
                              </div>
                            )}
                            <div className="product-meta">
                              <span className="prod-name">{p.name}</span>
                              <span className="prod-brand">{p.brand || "FEXA Haute Parfumerie"}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="variant-pill">{p.category || "Unisex"}</span>
                        </td>
                        <td>
                          <span className="variant-pill" style={{ background: "rgba(124, 92, 153, 0.25)" }}>
                            {p.volumeMl} ml
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: "#ffffff" }}>{p.unitsSold}</td>
                        <td>{p.ordersCount} orders</td>
                        <td>{formatINR(p.grossSales)}</td>
                        <td style={{ fontWeight: 800, color: "#d4c1e6" }}>{formatINR(p.netSales)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* PRODUCT PAGINATION */}
            <AdminPagination
              currentPage={productPagination.page}
              totalPages={productPagination.totalPages}
              totalItems={productPagination.totalVariants}
              pageSize={10}
              itemName="variants"
              onPageChange={(p) => setProductPage(p)}
              variant="standalone"
            />
          </section>

          {/* 7. DETAILED SALES REPORT TABLE */}
          <section className="sales-table-card">
            <div className="section-head-row">
              <div className="section-title-wrap">
                <h3>
                  <span>📋</span>
                  <span>Detailed Order & Sales Ledger</span>
                </h3>
                <p>Individual eligible transactions, snapshot order values, coupon redemptions, and statuses.</p>
              </div>
            </div>

            {/* CONTROLS: SEARCH & STATUS FILTERS */}
            <div className="table-controls-bar">
              <form className="table-filters-left" onSubmit={handleOrderSearchSubmit}>
                <input
                  type="text"
                  placeholder="Search order #, customer, coupon..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="table-search-input"
                />

                <select
                  className="table-select-filter"
                  value={orderStatusFilter}
                  onChange={(e) => {
                    setOrderStatusFilter(e.target.value);
                    setOrderPage(1);
                  }}
                >
                  <option value="All">All Order Statuses</option>
                  <option value="Processing">Processing</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>

                <select
                  className="table-select-filter"
                  value={paymentStatusFilter}
                  onChange={(e) => {
                    setPaymentStatusFilter(e.target.value);
                    setOrderPage(1);
                  }}
                >
                  <option value="All">All Payment Statuses</option>
                  <option value="Paid">Paid Only</option>
                  <option value="Pending">Pending Only</option>
                  <option value="Failed">Failed Only</option>
                </select>

                <select
                  className="table-select-filter"
                  value={paymentMethodFilter}
                  onChange={(e) => {
                    setPaymentMethodFilter(e.target.value);
                    setOrderPage(1);
                  }}
                >
                  <option value="All">All Payment Methods</option>
                  <option value="Razorpay">Razorpay Only</option>
                  <option value="COD">Cash on Delivery</option>
                </select>

                {(orderSearch || appliedOrderSearch) && (
                  <button type="button" className="sales-page-btn" onClick={handleClearOrderSearch}>
                    ✕ Clear Search
                  </button>
                )}
              </form>
            </div>

            <div className="sales-data-table-wrap">
              <table className="sales-data-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => handleToggleOrderSort("orderNumber")}>
                      ORDER # {orderSortBy === "orderNumber" ? (orderSortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="sortable" onClick={() => handleToggleOrderSort("createdAt")}>
                      DATE {orderSortBy === "createdAt" ? (orderSortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th>CUSTOMER</th>
                    <th>PRODUCTS & SIZES</th>
                    <th>UNITS</th>
                    <th>SUBTOTAL</th>
                    <th>COUPON</th>
                    <th>SHIPPING</th>
                    <th className="sortable" onClick={() => handleToggleOrderSort("totalAmount")}>
                      TOTAL AMOUNT {orderSortBy === "totalAmount" ? (orderSortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th>PAYMENT</th>
                    <th>STATUS</th>
                    <th style={{ textAlign: "center" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="12" className="sales-empty-box">
                        {appliedOrderSearch
                          ? `No transactions found matching "${appliedOrderSearch}"`
                          : "No orders found in the selected ledger range."}
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o._id}>
                        <td>
                          <span className="order-num-pill">{o.orderNumber}</span>
                        </td>
                        <td>{formatDateTime(o.createdAt)}</td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: 600, color: "#ffffff" }}>{o.customerName}</span>
                            <span style={{ fontSize: "10px", color: "#8c7b9e" }}>{o.customerPhone}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis" }}>
                            <span>{o.itemsSummary}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 700 }}>{o.totalUnits}</td>
                        <td>{formatINR(o.subtotal)}</td>
                        <td>
                          {o.couponCode ? (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span className="order-num-pill" style={{ color: "#d4c1e6" }}>
                                {o.couponCode}
                              </span>
                              <span style={{ fontSize: "10px", color: "#ff858d" }}>
                                -{formatINR(o.discountAmount)}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: "#6a5c7c" }}>—</span>
                          )}
                        </td>
                        <td>{o.shippingCost > 0 ? formatINR(o.shippingCost) : "Free"}</td>
                        <td style={{ fontWeight: 800, color: "#ffffff" }}>{formatINR(o.totalAmount)}</td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "10px", color: "#bfa8d8", fontWeight: 600 }}>
                              {o.paymentMethod}
                            </span>
                            <span
                              className={`status-badge ${
                                o.paymentStatus === "Paid"
                                  ? "paid"
                                  : o.paymentStatus === "Failed"
                                  ? "failed"
                                  : "pending"
                              }`}
                            >
                              ● {o.paymentStatus}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${
                              o.orderStatus === "Delivered"
                                ? "paid"
                                : o.orderStatus === "Cancelled"
                                ? "cancelled"
                                : "pending"
                            }`}
                          >
                            ● {o.orderStatus}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="inspect-order-btn"
                            onClick={() => handleOpenOrderModal(o)}
                            title="Inspect item coupon allocation and process returns"
                          >
                            <span>🔍</span>
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ORDERS PAGINATION */}
            <AdminPagination
              currentPage={orderPagination.page}
              totalPages={orderPagination.totalPages}
              totalItems={orderPagination.totalOrders}
              pageSize={10}
              itemName="transactions"
              onPageChange={(p) => setOrderPage(p)}
              variant="standalone"
            />
          </section>
        </main>
      </div>

      {/* ADMIN ORDER DETAILS & RETURN MANAGEMENT MODAL */}
      {isOrderModalOpen && selectedOrder && (
        <div className="order-modal-overlay" onClick={handleCloseOrderModal}>
          <div className="order-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* MODAL HEADER */}
            <div className="order-modal-header">
              <h3>
                <span>📦</span>
                <span>Manifest Details: {selectedOrder.orderNumber}</span>
              </h3>
              <button type="button" className="coupon-modal-close-btn" onClick={handleCloseOrderModal}>
                ✕
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="order-modal-body">
              {/* Alert Feedback */}
              {modalAlert && (
                <div className={`order-modal-alert ${modalAlert.type}`}>
                  <span>{modalAlert.type === "success" ? "✓" : "⚠️"}</span>
                  <span>{modalAlert.message}</span>
                </div>
              )}

              {/* META INFO GRID */}
              <div className="order-modal-meta-grid">
                <div className="order-meta-card">
                  <h4>Patron & Delivery Information</h4>
                  <p>
                    <strong>Customer:</strong> {selectedOrder.customerName || selectedOrder.user?.name || "Patron"}<br />
                    <strong>Email:</strong> {selectedOrder.customerEmail || selectedOrder.user?.email || "N/A"}<br />
                    <strong>Phone:</strong> {selectedOrder.customerPhone || selectedOrder.shippingAddress?.phone || "N/A"}<br />
                    <strong>Address:</strong> {[
                      selectedOrder.shippingAddress?.house,
                      selectedOrder.shippingAddress?.street || selectedOrder.shippingAddress?.addressLine,
                      selectedOrder.shippingAddress?.city,
                      selectedOrder.shippingAddress?.state,
                      selectedOrder.shippingAddress?.pincode,
                      selectedOrder.shippingAddress?.country,
                    ].filter(Boolean).join(", ") || "Standard Atelier Delivery"}
                  </p>
                </div>

                <div className="order-meta-card">
                  <h4>Transaction & Manifest Status</h4>
                  <p>
                    <strong>Placed On:</strong> {formatDateTime(selectedOrder.createdAt)}<br />
                    <strong>Payment Method:</strong> {selectedOrder.paymentMethod} ({selectedOrder.paymentStatus})<br />
                    <strong>Fulfillment Status:</strong> {selectedOrder.orderStatus}<br />
                    {selectedOrder.razorpayPaymentId && (
                      <>
                        <strong>Razorpay Payment ID:</strong>{" "}
                        <span style={{ fontFamily: "monospace", color: "#a184bd" }}>
                          {selectedOrder.razorpayPaymentId}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* FINANCIAL BREAKDOWN STRIP */}
              <div className="order-modal-financials-bar">
                <div className="order-fin-item">
                  <span>Merchandise Subtotal</span>
                  <strong>{formatINR(selectedOrder.subtotal)}</strong>
                </div>
                <div className="order-fin-item">
                  <span>Coupon Applied</span>
                  <strong style={{ color: selectedOrder.couponCode ? "#d4c1e6" : "#8c7f9c" }}>
                    {selectedOrder.couponCode || "None"}
                    {selectedOrder.discountPercentage ? ` (${selectedOrder.discountPercentage}%)` : ""}
                  </strong>
                </div>
                <div className="order-fin-item">
                  <span>Total Coupon Discount</span>
                  <strong className="discount">
                    {selectedOrder.discountAmount > 0 ? `-${formatINR(selectedOrder.discountAmount)}` : "₹0"}
                  </strong>
                </div>
                <div className="order-fin-item">
                  <span>Atelier Shipping</span>
                  <strong>{selectedOrder.shippingCost > 0 ? formatINR(selectedOrder.shippingCost) : "Complimentary"}</strong>
                </div>
                <div className="order-fin-item">
                  <span>Order Total Paid</span>
                  <strong className="total">{formatINR(selectedOrder.totalAmount)}</strong>
                </div>
                <div className="order-fin-item">
                  <span>Total Refunded</span>
                  <strong className="refunded">{formatINR(selectedOrder.totalRefundedAmount || 0)}</strong>
                </div>
              </div>

              {/* PER-PRODUCT DISCOUNT ALLOCATION & RETURN TABLE */}
              <div className="order-modal-table-wrap">
                <table className="order-modal-table">
                  <thead>
                    <tr>
                      <th>PRODUCT</th>
                      <th>SIZE</th>
                      <th style={{ textAlign: "center" }}>QTY</th>
                      <th>ORIGINAL UNIT</th>
                      <th>ORIGINAL LINE</th>
                      <th>COUPON DISCOUNT</th>
                      <th>DISCOUNTED LINE</th>
                      <th style={{ textAlign: "center" }}>RETURNED</th>
                      <th>REFUNDED</th>
                      <th>ITEM STATUS</th>
                      <th style={{ minWidth: "160px" }}>RETURN & REFUND ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!selectedOrder.items || selectedOrder.items.length === 0) ? (
                      <tr>
                        <td colSpan="11" style={{ textAlign: "center", padding: "20px" }}>
                          No fragrance items registered in this order snapshot.
                        </td>
                      </tr>
                    ) : (
                      selectedOrder.items.map((it) => {
                        const originalLine = it.originalLineAmount || (it.unitPrice * it.quantity);
                        const discount = it.allocatedCouponDiscount || 0;
                        const discountedLine = it.discountedLineAmount || (originalLine - discount);
                        const returnedQty = it.returnedQuantity || 0;
                        const availableToReturn = Math.max(0, it.quantity - returnedQty);
                        const currentSelectQty = returnQtyMap[it._id] || 1;
                        const effectiveUnitRefund = it.discountedUnitAmount || (discountedLine / it.quantity);
                        const isReturnRequested = it.itemStatus === "Return Requested";

                        return (
                          <tr key={it._id || it.variantId}>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <strong style={{ color: "#ffffff" }}>{it.name}</strong>
                                <span style={{ fontSize: "10px", color: "#8c7f9c" }}>{it.brand || "FEXA"}</span>
                              </div>
                            </td>
                            <td>
                              <span className="variant-pill" style={{ background: "rgba(124, 92, 153, 0.25)" }}>
                                {it.volumeMl} ml
                              </span>
                            </td>
                            <td style={{ textAlign: "center", fontWeight: 700, color: "#ffffff" }}>
                              {it.quantity}
                            </td>
                            <td>{formatINR(it.unitPrice)}</td>
                            <td style={{ fontWeight: 600 }}>{formatINR(originalLine)}</td>
                            <td style={{ color: discount > 0 ? "#ff858d" : "#8c7f9c", fontWeight: 700 }}>
                              {discount > 0 ? `-${formatINR(discount)}` : "—"}
                            </td>
                            <td style={{ fontWeight: 800, color: "#d4c1e6" }}>
                              {formatINR(discountedLine)}
                            </td>
                            <td style={{ textAlign: "center", fontWeight: 700, color: returnedQty > 0 ? "#ffd166" : "#8c7f9c" }}>
                              {returnedQty} / {it.quantity}
                            </td>
                            <td style={{ color: it.refundAmount > 0 ? "#ffd166" : "#8c7f9c", fontWeight: 700 }}>
                              {it.refundAmount > 0 ? formatINR(it.refundAmount) : "—"}
                            </td>
                            <td>
                              <span
                                className={`status-badge ${
                                  it.itemStatus === "Returned"
                                    ? "paid"
                                    : it.itemStatus === "Return Requested"
                                    ? "pending"
                                    : it.itemStatus === "Partially Returned"
                                    ? "pending"
                                    : "paid"
                                }`}
                              >
                                ● {it.itemStatus || "Active"}
                              </span>
                            </td>
                            <td>
                              <div className="return-action-panel">
                                {isReturnRequested ? (
                                  <>
                                    <span className="return-badge-requested">
                                      Req: {it.requestedReturnQuantity || 1} unit(s)
                                    </span>
                                    {it.returnReason && (
                                      <span style={{ fontSize: "10px", color: "#ded6e6", fontStyle: "italic" }}>
                                        "{it.returnReason}"
                                      </span>
                                    )}
                                    <span style={{ fontSize: "11px", color: "#38b2a3", fontWeight: 700 }}>
                                      Refund: {formatINR((it.requestedReturnQuantity || 1) * effectiveUnitRefund)}
                                    </span>
                                    <div className="return-btn-group">
                                      <button
                                        type="button"
                                        className="approve-refund-btn"
                                        disabled={modalProcessing}
                                        onClick={() => handleApproveReturn(it._id, it.requestedReturnQuantity || 1)}
                                      >
                                        ✓ Approve
                                      </button>
                                      <button
                                        type="button"
                                        className="reject-return-btn"
                                        disabled={modalProcessing}
                                        onClick={() => handleRejectReturn(it._id, "Return declined by administration.")}
                                      >
                                        ✕ Reject
                                      </button>
                                    </div>
                                  </>
                                ) : availableToReturn > 0 ? (
                                  <div className="direct-return-control">
                                    <select
                                      className="direct-return-qty-select"
                                      value={currentSelectQty}
                                      onChange={(e) =>
                                        setReturnQtyMap({
                                          ...returnQtyMap,
                                          [it._id]: parseInt(e.target.value, 10),
                                        })
                                      }
                                    >
                                      {Array.from({ length: availableToReturn }, (_, idx) => idx + 1).map((n) => (
                                        <option key={n} value={n}>
                                          {n} unit{n > 1 ? "s" : ""}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      className="approve-refund-btn"
                                      disabled={modalProcessing}
                                      onClick={() => handleApproveReturn(it._id, currentSelectQty)}
                                      title={`Process return and refund ${formatINR(currentSelectQty * effectiveUnitRefund)}`}
                                    >
                                      Refund {formatINR(currentSelectQty * effectiveUnitRefund)}
                                    </button>
                                  </div>
                                ) : (
                                  <span style={{ color: "#38b2a3", fontSize: "11px", fontWeight: 700 }}>
                                    ✓ Fully Refunded
                                  </span>
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
            </div>

            {/* MODAL FOOTER */}
            <div className="order-modal-footer">
              <button type="button" className="coupon-modal-cancel-btn" onClick={handleCloseOrderModal}>
                Close Manifest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSales;
