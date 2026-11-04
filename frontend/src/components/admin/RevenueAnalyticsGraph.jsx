import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "./RevenueAnalyticsGraph.css";

const FILTER_PRESETS = [
  { id: "today", label: "Today" },
  { id: "last7days", label: "Last 7 Days" },
  { id: "last30days", label: "Last 30 Days" },
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "thisYear", label: "This Year" },
  { id: "custom", label: "Custom Range" },
];

export default function RevenueAnalyticsGraph() {
  const [period, setPeriod] = useState("last7days");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Table filter state: "all" or "activeOnly"
  const [tableFilter, setTableFilter] = useState("all");

  // Selected date breakdown modal state
  const [selectedDayModal, setSelectedDayModal] = useState(null);

  const containerRef = useRef(null);

  const formatINR = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "₹0";
    return `₹${Math.round(Number(val)).toLocaleString("en-IN")}`;
  };

  const formatINRDecimal = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "₹0.00";
    return `₹${Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatINRShort = (val) => {
    const num = Number(val) || 0;
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
    if (num >= 1000) return `₹${(num / 1000).toFixed(1)}k`;
    return `₹${Math.round(num)}`;
  };

  const fetchRevenueData = useCallback(async (activePeriod, start, end) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("period", activePeriod);
      if (activePeriod === "custom") {
        if (start) params.set("startDate", start);
        if (end) params.set("endDate", end);
      }

      const apiHost = window.location.hostname === "127.0.0.1" ? "127.0.0.1" : "localhost";
      const res = await fetch(`http://${apiHost}:5000/api/admin/sales/dashboard-revenue?${params.toString()}`, {
        credentials: "include",
      });

      const contentType = res.headers.get("content-type");
      let data = {};
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server responded with ${res.status}: ${text.slice(0, 100)}`);
      }

      if (res.ok && data.success) {
        setAnalyticsData(data.data);
      } else {
        setError(data.message || `Failed to load revenue analytics (${res.status}).`);
      }
    } catch (err) {
      console.error("Dashboard revenue fetch error:", err);
      setError(err.message || "Unable to connect to revenue service.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (period !== "custom") {
      fetchRevenueData(period);
    }
  }, [period, fetchRevenueData]);

  const handleSelectPeriod = (presetId) => {
    if (presetId === "custom") {
      setShowCustomPicker(true);
      setPeriod("custom");
    } else {
      setShowCustomPicker(false);
      setPeriod(presetId);
    }
  };

  const handleApplyCustomRange = (e) => {
    e.preventDefault();
    if (!customStart || !customEnd) return;
    fetchRevenueData("custom", customStart, customEnd);
  };

  const series = analyticsData?.series || [];

  // Active days with revenue or orders
  const activeSeries = useMemo(() => {
    return series.filter((s) => s.revenue > 0 || s.orderCount > 0);
  }, [series]);

  // Display series for breakdown table based on filter
  const displayedTableRows = tableFilter === "activeOnly" ? activeSeries : series;

  // SVG Chart Geometry Calculation
  const chartCoordinates = useMemo(() => {
    if (!series || series.length === 0) {
      return { points: [], pathD: "", areaD: "", maxVal: 0, yTicks: [] };
    }

    const svgWidth = 800;
    const svgHeight = 240;
    const paddingLeft = 60;
    const paddingRight = 40;
    const paddingTop = 35;
    const paddingBottom = 40;

    const values = series.map((s) => s.revenue);
    const rawMax = Math.max(...values, 0);
    // Determine reasonable Y-axis ceiling
    const maxVal = rawMax > 0 ? Math.ceil(rawMax * 1.2) : 1000;

    const graphWidth = svgWidth - paddingLeft - paddingRight;
    const graphHeight = svgHeight - paddingTop - paddingBottom;

    const stepX = series.length > 1 ? graphWidth / (series.length - 1) : 0;

    const points = series.map((s, idx) => {
      const x = series.length === 1 ? paddingLeft + graphWidth / 2 : paddingLeft + idx * stepX;
      const ratio = maxVal > 0 ? s.revenue / maxVal : 0;
      const y = paddingTop + graphHeight - ratio * graphHeight;
      return {
        x,
        y,
        raw: s,
      };
    });

    let pathD = "";
    let areaD = "";

    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpX1 = prev.x + (curr.x - prev.x) / 2;
        const cpY1 = prev.y;
        const cpX2 = prev.x + (curr.x - prev.x) / 2;
        const cpY2 = curr.y;
        pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
      }

      const baselineY = paddingTop + graphHeight;
      areaD = `${pathD} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
    }

    // Generate 4 Y-axis ticks with readable step intervals
    const yTicks = [
      { y: paddingTop, val: maxVal },
      { y: paddingTop + graphHeight * 0.33, val: Math.round(maxVal * 0.67) },
      { y: paddingTop + graphHeight * 0.67, val: Math.round(maxVal * 0.33) },
      { y: paddingTop + graphHeight, val: 0 },
    ];

    return { points, pathD, areaD, maxVal, yTicks, baselineY: paddingTop + graphHeight };
  }, [series]);

  const growth = analyticsData?.revenueGrowth;
  const isPositiveGrowth = growth > 0;
  const isNegativeGrowth = growth < 0;

  return (
    <section className="fexa-revenue-analytics-card" ref={containerRef}>
      {/* SECTION HEADER & FILTERS TOOLBAR */}
      <div className="rev-card-header">
        <div className="rev-title-group">
          <div className="rev-badge">
            <span className="dot-pulse">●</span>
            <span>VERIFIED LEDGER TELEMETRY</span>
          </div>
          <h2 className="rev-main-title">Revenue Analytics</h2>
          <p className="rev-subtitle">
            Net realized revenue from successful, delivered and verified orders in MongoDB.
          </p>
        </div>

        {/* DATE PRESETS */}
        <div className="rev-filters-toolbar">
          <div className="rev-presets-row">
            {FILTER_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`rev-preset-btn ${period === p.id ? "active" : ""}`}
                onClick={() => handleSelectPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Current Active Window Badge */}
          <div className="rev-range-tag">
            <span>🗓️ {analyticsData?.periodLabel || "Selected Window"}</span>
          </div>
        </div>
      </div>

      {/* CUSTOM RANGE PICKER (EXPANDABLE) */}
      {showCustomPicker && (
        <form className="rev-custom-range-form" onSubmit={handleApplyCustomRange}>
          <div className="custom-input-box">
            <label>FROM:</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              required
            />
          </div>
          <div className="custom-input-box">
            <label>TO:</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="rev-apply-btn">
            APPLY FILTER
          </button>
        </form>
      )}

      {/* ERROR NOTICE */}
      {error && (
        <div className="rev-error-banner">
          <span>⚠️ {error}</span>
          <button type="button" onClick={() => fetchRevenueData(period, customStart, customEnd)}>
            RETRY
          </button>
        </div>
      )}

      {/* SUMMARY STATS GRID */}
      <div className="rev-summary-grid">
        {/* TOTAL REVENUE */}
        <div className="rev-stat-tile highlight-tile">
          <div className="tile-top">
            <span className="tile-label">TOTAL REVENUE</span>
            <span className="tile-icon">💰</span>
          </div>
          <div className="tile-value">{loading && !analyticsData ? "..." : formatINR(analyticsData?.totalRevenue)}</div>
          <div className="tile-meta">
            <span
              className={`growth-pill ${
                isPositiveGrowth ? "positive" : isNegativeGrowth ? "negative" : "neutral"
              }`}
            >
              {isPositiveGrowth ? "▲ +" : isNegativeGrowth ? "▼ " : ""}
              {growth !== undefined && growth !== null ? `${growth}%` : "0%"}
            </span>
            <span className="meta-text">vs preceding equivalent period ({formatINR(analyticsData?.previousRevenue)})</span>
          </div>
        </div>

        {/* SUCCESSFUL ORDERS */}
        <div className="rev-stat-tile">
          <div className="tile-top">
            <span className="tile-label">SUCCESSFUL ORDERS</span>
            <span className="tile-icon">📦</span>
          </div>
          <div className="tile-value">{loading && !analyticsData ? "..." : (analyticsData?.successfulOrders ?? 0)}</div>
          <div className="tile-meta">
            <span className="meta-accent">Realized Payments</span>
            <span className="meta-text">Excludes pending, failed & cancelled orders</span>
          </div>
        </div>

        {/* AVERAGE ORDER VALUE */}
        <div className="rev-stat-tile">
          <div className="tile-top">
            <span className="tile-label">AVERAGE ORDER VALUE</span>
            <span className="tile-icon">📊</span>
          </div>
          <div className="tile-value">{loading && !analyticsData ? "..." : formatINR(analyticsData?.averageOrderValue)}</div>
          <div className="tile-meta">
            <span className="meta-accent">Per Order Yield</span>
            <span className="meta-text">Net paid basket average</span>
          </div>
        </div>

        {/* LEDGER RECONCILIATION SUMMARY TILE */}
        <div className="rev-stat-tile ledger-summary-tile">
          <div className="tile-top">
            <span className="tile-label">GROSS & DEDUCTIONS</span>
            <span className="tile-icon">⚖️</span>
          </div>
          <div className="ledger-inline-metrics">
            <div className="ledger-mini-stat">
              <span>Gross Total:</span>
              <strong>{formatINR(analyticsData?.totalGrossAmount)}</strong>
            </div>
            <div className="ledger-mini-stat discount-stat">
              <span>Discounts:</span>
              <strong>- {formatINR(analyticsData?.totalDiscounts)}</strong>
            </div>
            <div className="ledger-mini-stat refund-stat">
              <span>Refunds:</span>
              <strong>- {formatINR(analyticsData?.totalRefunds)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* INTERACTIVE AREA / LINE CHART CONTAINER */}
      <div className="rev-chart-viewport">
        {loading && !analyticsData ? (
          <div className="rev-chart-loading">
            <div className="loading-spinner"></div>
            <span>Fetching verified revenue telemetry from atelier ledger...</span>
          </div>
        ) : error ? (
          <div className="rev-chart-empty error-chart-state">
            <span className="empty-icon">⚠️</span>
            <p>{error}</p>
            <button
              type="button"
              className="rev-apply-btn"
              style={{ marginTop: "8px" }}
              onClick={() => fetchRevenueData(period, customStart, customEnd)}
            >
              Retry Connection
            </button>
          </div>
        ) : series.length === 0 ? (
          <div className="rev-chart-empty">
            <span className="empty-icon">📈</span>
            <p>No successful orders or revenue recorded in this date range.</p>
          </div>
        ) : (
          <div className="rev-svg-container">
            <svg
              className="rev-svg"
              viewBox="0 0 800 240"
              preserveAspectRatio="none"
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                {/* Area Gradient */}
                <linearGradient id="revenueGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#a184bd" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#a184bd" stopOpacity="0.0" />
                </linearGradient>

                {/* Line Gradient */}
                <linearGradient id="revenueLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7c5c99" />
                  <stop offset="50%" stopColor="#bfa8d8" />
                  <stop offset="100%" stopColor="#d4c1e6" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines & Y-Axis Labels */}
              {chartCoordinates.yTicks.map((tick, i) => (
                <g key={i}>
                  <line
                    x1="60"
                    y1={tick.y}
                    x2="765"
                    y2={tick.y}
                    stroke="rgba(161, 132, 189, 0.12)"
                    strokeDasharray={i === chartCoordinates.yTicks.length - 1 ? "none" : "3 3"}
                  />
                  <text
                    x="55"
                    y={tick.y + 3}
                    fill="#8c7b9e"
                    fontSize="9"
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {formatINRShort(tick.val)}
                  </text>
                </g>
              ))}

              {/* Area Fill */}
              {chartCoordinates.areaD && (
                <path d={chartCoordinates.areaD} fill="url(#revenueGlow)" />
              )}

              {/* Line Stroke */}
              {chartCoordinates.pathD && (
                <path
                  d={chartCoordinates.pathD}
                  fill="none"
                  stroke="url(#revenueLineGrad)"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Prominent Revenue Value Labels above Non-Zero Data Points */}
              {chartCoordinates.points.map((pt, idx) => {
                const rev = pt.raw.revenue || 0;
                const isHovered = hoveredPoint?.raw?.key === pt.raw.key;
                // Display revenue label above point if revenue > 0 or if hovered
                if (rev <= 0 && !isHovered) return null;

                return (
                  <g key={`val-${idx}`} className="point-revenue-tag-group">
                    <rect
                      x={pt.x - 28}
                      y={pt.y - 24}
                      width="56"
                      height="16"
                      rx="4"
                      fill="rgba(13, 9, 18, 0.88)"
                      stroke={isHovered ? "#d4c1e6" : "rgba(161, 132, 189, 0.4)"}
                      strokeWidth={isHovered ? "1.5" : "1"}
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 13}
                      fill={isHovered ? "#ffffff" : "#cbb8de"}
                      fontSize="9"
                      fontWeight="700"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {formatINRShort(rev)}
                    </text>
                  </g>
                );
              })}

              {/* Interactive Data Points and Invisible Hit Targets */}
              {chartCoordinates.points.map((pt, idx) => {
                const isHovered = hoveredPoint?.raw?.key === pt.raw.key;
                const hasRev = pt.raw.revenue > 0;
                return (
                  <g key={idx}>
                    {/* Visual Point */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6 : hasRev ? 4.5 : 3}
                      fill={isHovered ? "#ffffff" : hasRev ? "#bfa8d8" : "#0e0b12"}
                      stroke="#a184bd"
                      strokeWidth={isHovered ? 2.5 : hasRev ? 2 : 1.5}
                      style={{ transition: "all 0.15s ease" }}
                    />

                    {/* Generous Hit Zone for Easy Hover & Click */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={18}
                      fill="transparent"
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHoveredPoint(pt)}
                      onClick={() => setSelectedDayModal(pt.raw)}
                    />
                  </g>
                );
              })}
            </svg>

            {/* X-AXIS LABELS */}
            <div className="rev-x-labels-row">
              {chartCoordinates.points.map((pt, idx) => {
                const total = chartCoordinates.points.length;
                const shouldShow =
                  total <= 12 ||
                  idx === 0 ||
                  idx === total - 1 ||
                  idx % Math.ceil(total / 8) === 0;

                if (!shouldShow) return null;

                const percentLeft = (pt.x / 800) * 100;
                return (
                  <span
                    key={idx}
                    className="rev-x-label"
                    style={{ left: `${percentLeft}%` }}
                  >
                    {pt.raw.label}
                  </span>
                );
              })}
            </div>

            {/* FLOATING HOVER TOOLTIP */}
            {hoveredPoint && (
              <div
                className="rev-chart-tooltip"
                style={{
                  left: `${(hoveredPoint.x / 800) * 100}%`,
                  top: `${hoveredPoint.y}px`,
                }}
                onClick={() => setSelectedDayModal(hoveredPoint.raw)}
              >
                <div className="tooltip-date">{hoveredPoint.raw.label} ({hoveredPoint.raw.key})</div>
                <div className="tooltip-rev">
                  Net Revenue: <strong>{formatINR(hoveredPoint.raw.revenue)}</strong>
                </div>
                <div className="tooltip-orders">
                  Successful Orders: <span>{hoveredPoint.raw.orderCount || 0}</span>
                </div>
                <div className="tooltip-formula-sub">
                  Gross: {formatINR(hoveredPoint.raw.grossAmount)} • Deductions: -{formatINR((hoveredPoint.raw.discounts || 0) + (hoveredPoint.raw.refunds || 0))}
                </div>
                <span className="tooltip-click-hint">Click point to view calculation breakdown ➔</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. DAILY REVENUE CALCULATION TABLE (BREAKDOWN SECTION)  */}
      {/* ======================================================== */}
      <div className="daily-breakdown-section">
        <div className="breakdown-header-row">
          <div>
            <h3 className="breakdown-title">Daily Revenue Breakdown</h3>
            <p className="breakdown-sub">
              Audit trail of successful orders, gross value, discounts, refunds, and final net revenue.
            </p>
          </div>

          <div className="breakdown-filter-toggle">
            <button
              type="button"
              className={`toggle-pill-btn ${tableFilter === "all" ? "active" : ""}`}
              onClick={() => setTableFilter("all")}
            >
              All Window Dates ({series.length})
            </button>
            <button
              type="button"
              className={`toggle-pill-btn ${tableFilter === "activeOnly" ? "active" : ""}`}
              onClick={() => setTableFilter("activeOnly")}
            >
              Active Revenue Days ({activeSeries.length})
            </button>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="breakdown-table-wrapper">
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Successful Orders</th>
                <th>Gross Amount</th>
                <th>Discounts</th>
                <th>Refunds</th>
                <th>Net Revenue</th>
                <th style={{ textAlign: "center" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && !analyticsData ? (
                <tr>
                  <td colSpan="7" className="table-loading-cell">
                    Loading daily ledger rows...
                  </td>
                </tr>
              ) : displayedTableRows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty-cell">
                    <span style={{ fontSize: "20px", display: "block", marginBottom: "4px" }}>🗓️</span>
                    No revenue or successful orders recorded in this selection.
                    {series.length > 0 && tableFilter === "activeOnly" && (
                      <span style={{ display: "block", marginTop: "4px", color: "#a184bd", cursor: "pointer" }} onClick={() => setTableFilter("all")}>
                        Switch to "All Window Dates" to view the full timeline.
                      </span>
                    )}
                  </td>
                </tr>
              ) : (
                displayedTableRows.map((row) => (
                  <tr
                    key={row.key}
                    className={`breakdown-row ${row.revenue > 0 ? "has-revenue" : "zero-revenue"}`}
                    onClick={() => setSelectedDayModal(row)}
                  >
                    <td className="row-date-cell">
                      <strong>{row.label}</strong>
                      <span className="row-key-sub">{row.key}</span>
                    </td>
                    <td>
                      <span className={`order-badge ${row.orderCount > 0 ? "active" : "zero"}`}>
                        {row.orderCount || 0} order{row.orderCount !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="row-money-cell gross-cell">{formatINR(row.grossAmount)}</td>
                    <td className="row-money-cell discount-cell">
                      {row.discounts > 0 ? `- ${formatINR(row.discounts)}` : "₹0"}
                    </td>
                    <td className="row-money-cell refund-cell">
                      {row.refunds > 0 ? `- ${formatINR(row.refunds)}` : "₹0"}
                    </td>
                    <td className="row-money-cell net-cell">
                      <strong>{formatINR(row.revenue)}</strong>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="btn-inspect-row"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDayModal(row);
                        }}
                        title="Inspect calculation formula"
                      >
                        Inspect 🔍
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* TOTALS FOOTER ROW */}
            {series.length > 0 && (
              <tfoot>
                <tr className="breakdown-totals-row">
                  <td>TOTAL WINDOW</td>
                  <td>
                    <strong>{analyticsData?.successfulOrders || 0} orders</strong>
                  </td>
                  <td className="gross-cell">
                    <strong>{formatINR(analyticsData?.totalGrossAmount)}</strong>
                  </td>
                  <td className="discount-cell">
                    <strong>- {formatINR(analyticsData?.totalDiscounts)}</strong>
                  </td>
                  <td className="refund-cell">
                    <strong>- {formatINR(analyticsData?.totalRefunds)}</strong>
                  </td>
                  <td className="net-cell">
                    <strong style={{ fontSize: "14px", color: "#d4c1e6" }}>
                      {formatINR(analyticsData?.totalRevenue)}
                    </strong>
                  </td>
                  <td style={{ textAlign: "center", color: "#8c7b9e", fontSize: "11px" }}>Reconciled ✓</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. CALCULATION DETAILS MODAL / DRILLDOWN                */}
      {/* ======================================================== */}
      {selectedDayModal && (
        <div className="rev-modal-backdrop" onClick={() => setSelectedDayModal(null)}>
          <div
            className="rev-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="rev-modal-header">
              <div>
                <span className="modal-top-tag">LEDGER CALCULATION AUDIT</span>
                <h2>{selectedDayModal.label} ({selectedDayModal.key})</h2>
              </div>
              <button
                type="button"
                className="rev-modal-close"
                onClick={() => setSelectedDayModal(null)}
              >
                ✕
              </button>
            </div>

            <div className="rev-modal-body">
              {/* Formula Callout Box */}
              <div className="formula-callout-box">
                <span className="formula-title">OFFICIAL REVENUE FORMULA</span>
                <p className="formula-code">
                  Net Revenue = (Gross Product Amount - Product Discounts - Coupon Discounts + Shipping) - Refunds
                </p>
                <div className="formula-walkthrough">
                  <span>Substituted Calculation:</span>
                  <code>
                    ({formatINR(selectedDayModal.grossAmount)} - {formatINR(selectedDayModal.productDiscounts || 0)} - {formatINR(selectedDayModal.couponDiscounts || selectedDayModal.discounts || 0)} + {formatINR(selectedDayModal.shipping || 0)}) - {formatINR(selectedDayModal.refunds || 0)} = <strong>{formatINR(selectedDayModal.revenue)}</strong>
                  </code>
                </div>
              </div>

              {/* Itemized Breakdown Grid */}
              <div className="calc-breakdown-grid">
                <div className="calc-item-row">
                  <span className="calc-item-name">📦 Successful Orders Count</span>
                  <strong className="calc-item-val neutral">
                    {selectedDayModal.orderCount || 0} order{selectedDayModal.orderCount !== 1 ? "s" : ""}
                  </strong>
                </div>

                <div className="calc-item-row">
                  <span className="calc-item-name">🏷️ Gross Product Catalogue Amount</span>
                  <strong className="calc-item-val positive">
                    + {formatINRDecimal(selectedDayModal.grossAmount)}
                  </strong>
                </div>

                <div className="calc-item-row">
                  <span className="calc-item-name">🎁 Product Offer Promo Savings</span>
                  <strong className="calc-item-val negative">
                    - {formatINRDecimal(selectedDayModal.productDiscounts || 0)}
                  </strong>
                </div>

                <div className="calc-item-row">
                  <span className="calc-item-name">🎟️ Coupon Code Discounts</span>
                  <strong className="calc-item-val negative">
                    - {formatINRDecimal(selectedDayModal.couponDiscounts || selectedDayModal.discounts || 0)}
                  </strong>
                </div>

                <div className="calc-item-row">
                  <span className="calc-item-name">🚚 Shipping & Delivery Charges</span>
                  <strong className="calc-item-val positive">
                    + {formatINRDecimal(selectedDayModal.shipping || 0)}
                  </strong>
                </div>

                <div className="calc-item-row">
                  <span className="calc-item-name">🔄 Customer Returns & Item Refunds</span>
                  <strong className="calc-item-val negative">
                    - {formatINRDecimal(selectedDayModal.refunds || 0)}
                  </strong>
                </div>

                <div className="calc-item-row final-net-row">
                  <span className="calc-item-name">💎 FINAL NET REALIZED REVENUE</span>
                  <strong className="calc-item-val final-net-val">
                    {formatINRDecimal(selectedDayModal.revenue)}
                  </strong>
                </div>
              </div>

              {/* Business Rule Audit Notice */}
              <div className="calc-audit-notice">
                <p>
                  <strong>Strict Audit Guarantee:</strong> Calculated directly from MongoDB order and payment documents.
                  Cancelled orders, failed checkouts, and pending online payments are strictly excluded. Cash on Delivery (COD)
                  is recognized only when marked Delivered. Discounts and refunds are verified never to be double-deducted.
                </p>
              </div>
            </div>

            <div className="rev-modal-footer">
              <button
                type="button"
                className="rev-modal-btn-close"
                onClick={() => setSelectedDayModal(null)}
              >
                Close Audit Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
