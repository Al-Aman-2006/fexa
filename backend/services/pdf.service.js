import PDFDocument from "pdfkit";

/**
 * Format currency in Indian Rupees notation for standard PDF fonts.
 * Uses "Rs." prefix for 100% reliable glyph rendering across all PDF readers without font embedding issues.
 */
export const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return `Rs. ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Format date string into human readable Indian standard date/time.
 */
export const formatDateTime = (dateStr) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDateOnly = (dateStr) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/**
 * GENERATE ORDER INVOICE PDF
 * Streams a professional luxury tax invoice directly into the Express response.
 *
 * @param {Object} order - Populated/normalized order document
 * @param {Object} customer - Customer user details
 * @param {Object} res - Express response stream
 */
export const streamOrderInvoicePDF = (order, customer, res) => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
  });

  const filename = `FEXA-Invoice-${order.orderNumber || "ORD"}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  doc.pipe(res);

  const primaryColor = "#1f172b";
  const accentGold = "#9d783e";
  const textDark = "#251d2f";
  const textMuted = "#6b6178";
  const tableHeaderBg = "#2d223c";
  const tableBorder = "#e5dded";
  const rowAltBg = "#fbf9fd";

  // --- BRAND HEADER ---
  doc.rect(40, 40, 515, 65).fill(primaryColor);

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(20).text("F E X A", 55, 52, {
    characterSpacing: 4,
  });
  doc.font("Helvetica").fontSize(8).fillColor("#dcd2e6").text(
    "HAUTE PARFUMERIE • ATELIER DISPATCH MANIFEST",
    55,
    76,
    { characterSpacing: 1.5 }
  );

  doc.font("Helvetica-Bold").fontSize(14).fillColor("#f5e6cc").text(
    "TAX INVOICE",
    350,
    52,
    { align: "right", width: 190 }
  );
  doc.font("Helvetica").fontSize(8).fillColor("#dcd2e6").text(
    `Invoice: INV-${order.orderNumber}`,
    350,
    72,
    { align: "right", width: 190 }
  );
  doc.font("Helvetica").fontSize(8).fillColor("#dcd2e6").text(
    `Date: ${formatDateTime(order.createdAt)}`,
    350,
    84,
    { align: "right", width: 190 }
  );

  let curY = 120;

  // --- ORDER & CUSTOMER INFORMATION GRID ---
  doc.rect(40, curY, 250, 95).fillAndStroke("#ffffff", tableBorder);
  doc.rect(40, curY, 250, 20).fill("#f6f2fa");
  doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(8).text("BILLED TO & DELIVERED TO", 50, curY + 6);

  const address = order.shippingAddress || {};
  const recipientName = address.fullName || customer?.name || "FEXA Patron";
  const recipientEmail = customer?.email || "N/A";
  const recipientPhone = address.phone || customer?.phone || "N/A";
  const addressLine = [
    address.house,
    address.street || address.addressLine,
    address.city,
    address.state,
    address.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  doc.fillColor(textDark).font("Helvetica-Bold").fontSize(9).text(recipientName, 50, curY + 26);
  doc.font("Helvetica").fontSize(8).fillColor(textMuted).text(`Email: ${recipientEmail}`, 50, curY + 38);
  doc.text(`Phone: ${recipientPhone}`, 50, curY + 49);
  doc.text(`Address: ${addressLine || "On file in client profile"}`, 50, curY + 60, {
    width: 230,
    height: 30,
    ellipsis: true,
  });

  // Meta Box (Right)
  doc.rect(305, curY, 250, 95).fillAndStroke("#ffffff", tableBorder);
  doc.rect(305, curY, 250, 20).fill("#f6f2fa");
  doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(8).text("ORDER & PAYMENT AUDIT", 315, curY + 6);

  doc.fillColor(textDark).font("Helvetica").fontSize(8);
  doc.text("Order Number:", 315, curY + 28);
  doc.font("Helvetica-Bold").text(order.orderNumber, 410, curY + 28);

  doc.font("Helvetica").text("Payment Method:", 315, curY + 41);
  const pMethod = order.paymentMethod === "COD" ? "Cash on Delivery" : order.paymentMethod === "Razorpay" ? "Razorpay Online" : (order.paymentMethod || "Online");
  doc.font("Helvetica-Bold").text(pMethod, 410, curY + 41);

  doc.font("Helvetica").text("Payment Status:", 315, curY + 54);
  const isPaid = order.paymentStatus === "Paid";
  doc.font("Helvetica-Bold").fillColor(isPaid ? "#057a55" : "#b43403").text(order.paymentStatus || "Pending", 410, curY + 54);

  doc.fillColor(textDark).font("Helvetica").text("Order Status:", 315, curY + 67);
  doc.font("Helvetica-Bold").text(order.orderStatus || "Processing", 410, curY + 67);

  if (order.razorpayPaymentId) {
    doc.font("Helvetica").fontSize(7).fillColor(textMuted).text("Payment ID:", 315, curY + 80);
    doc.font("Helvetica-Bold").fontSize(7).text(order.razorpayPaymentId, 410, curY + 80);
  }

  curY += 115;

  // --- ITEM TABLE HEADERS ---
  const colX = {
    num: 40,
    desc: 65,
    unit: 250,
    qty: 310,
    offer: 345,
    coupon: 410,
    net: 480,
  };

  const drawTableHeader = (y) => {
    doc.rect(40, y, 515, 22).fill(tableHeaderBg);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
    doc.text("#", colX.num + 6, y + 7);
    doc.text("FRAGRANCE / FLACON", colX.desc, y + 7);
    doc.text("PRICE", colX.unit, y + 7, { width: 55, align: "right" });
    doc.text("QTY", colX.qty, y + 7, { width: 30, align: "center" });
    doc.text("OFFER", colX.offer, y + 7, { width: 55, align: "right" });
    doc.text("COUPON", colX.coupon, y + 7, { width: 60, align: "right" });
    doc.text("TOTAL", colX.net, y + 7, { width: 70, align: "right" });
  };

  drawTableHeader(curY);
  curY += 22;

  // --- ITEMS ROWS ---
  const items = order.items || [];
  items.forEach((it, idx) => {
    // Check if new page is needed
    if (curY > 680) {
      doc.addPage();
      curY = 40;
      drawTableHeader(curY);
      curY += 22;
    }

    const rowBg = idx % 2 === 1 ? rowAltBg : "#ffffff";
    const rowHeight = 32;
    doc.rect(40, curY, 515, rowHeight).fillAndStroke(rowBg, tableBorder);

    // Calculation breakdown
    const basePrice = Number(it.originalPrice !== undefined ? it.originalPrice : it.unitPrice || 0);
    const effPrice = Number(it.offerAdjustedUnitPrice !== undefined ? it.offerAdjustedUnitPrice : it.unitPrice || basePrice);
    const offerSavings = Math.max(0, (basePrice - effPrice) * it.quantity);
    const couponDiscount = Number(it.allocatedCouponDiscount || 0);
    const netAmount = Number(
      it.discountedLineAmount !== undefined
        ? it.discountedLineAmount
        : (it.lineTotal || (effPrice * it.quantity)) - couponDiscount
    );

    doc.fillColor(textDark).font("Helvetica-Bold").fontSize(8).text(String(idx + 1), colX.num + 6, curY + 6);

    // Product Title & Size
    const volText = it.volumeMl ? ` (${it.volumeMl}ml)` : "";
    const isCancelled = it.itemStatus === "Cancelled";
    doc.fillColor(isCancelled ? "#991b1b" : textDark).font("Helvetica-Bold").fontSize(8);
    doc.text(`${it.name}${volText}${isCancelled ? " [CANCELLED]" : ""}`, colX.desc, curY + 6, {
      width: 180,
      ellipsis: true,
    });

    doc.font("Helvetica").fontSize(7).fillColor(textMuted);
    const metaNote = isCancelled && it.refundStatus === "Refunded"
      ? `Refunded to Wallet: ${formatCurrency(it.refundAmount || netAmount)}`
      : it.brand || "Maison FEXA Luxury Flacon";
    doc.text(metaNote, colX.desc, curY + 18, { width: 180, ellipsis: true });

    // Numeric Columns
    doc.fillColor(textDark).font("Helvetica").fontSize(8);
    doc.text(formatCurrency(basePrice), colX.unit, curY + 11, { width: 55, align: "right" });
    doc.text(String(it.quantity), colX.qty, curY + 11, { width: 30, align: "center" });

    doc.fillColor(offerSavings > 0 ? "#b43403" : textMuted);
    doc.text(offerSavings > 0 ? `-${formatCurrency(offerSavings)}` : "—", colX.offer, curY + 11, { width: 55, align: "right" });

    doc.fillColor(couponDiscount > 0 ? "#057a55" : textMuted);
    doc.text(couponDiscount > 0 ? `-${formatCurrency(couponDiscount)}` : "—", colX.coupon, curY + 11, { width: 60, align: "right" });

    doc.fillColor(isCancelled ? "#991b1b" : textDark).font("Helvetica-Bold");
    doc.text(formatCurrency(netAmount), colX.net, curY + 11, { width: 70, align: "right" });

    curY += rowHeight;
  });

  curY += 12;

  // Ensure room for summary section
  if (curY > 640) {
    doc.addPage();
    curY = 40;
  }

  // --- SUMMARY / TOTALS SECTION ---
  const summaryX = 320;
  const summaryWidth = 235;

  doc.rect(summaryX, curY, summaryWidth, 115).fillAndStroke("#ffffff", tableBorder);

  const drawSummaryLine = (label, value, y, isBold = false, color = textDark) => {
    doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(color);
    doc.text(label, summaryX + 12, y);
    doc.text(value, summaryX + 120, y, { width: summaryWidth - 132, align: "right" });
  };

  const origSubtotal = Number(order.originalSubtotal || order.subtotal || 0);
  const totalOffer = Number(order.totalOfferDiscount || 0);
  const couponDiscount = Number(order.discountAmount || 0);
  const shipping = Number(order.shippingCost || 0);
  const totalPayable = Number(order.totalAmount || 0);

  drawSummaryLine("Merchandise Subtotal:", formatCurrency(origSubtotal), curY + 10);
  if (totalOffer > 0) {
    drawSummaryLine("Product Promotional Offers:", `-${formatCurrency(totalOffer)}`, curY + 24, false, "#b43403");
  } else {
    drawSummaryLine("Product Offers:", "Rs. 0.00", curY + 24, false, textMuted);
  }

  if (couponDiscount > 0) {
    const coupCode = order.couponCode ? ` (${order.couponCode})` : "";
    drawSummaryLine(`Coupon Discount${coupCode}:`, `-${formatCurrency(couponDiscount)}`, curY + 38, false, "#057a55");
  } else {
    drawSummaryLine("Coupon Savings:", "Rs. 0.00", curY + 38, false, textMuted);
  }

  drawSummaryLine("Delivery / Dispatch:", shipping === 0 ? "Complimentary" : formatCurrency(shipping), curY + 52);

  doc.rect(summaryX, curY + 68, summaryWidth, 24).fill(primaryColor);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff");
  doc.text("TOTAL PAID / DUE:", summaryX + 12, curY + 75);
  doc.fillColor("#f5e6cc").text(formatCurrency(totalPayable), summaryX + 120, curY + 75, {
    width: summaryWidth - 132,
    align: "right",
  });

  if (order.totalRefundedAmount && order.totalRefundedAmount > 0) {
    drawSummaryLine("Total Refunded to Wallet:", formatCurrency(order.totalRefundedAmount), curY + 98, true, "#991b1b");
  }

  // --- ATELIER NOTES & POLICIES (LEFT OF SUMMARY) ---
  const notesWidth = 260;
  doc.rect(40, curY, notesWidth, 115).fillAndStroke("#fbf9fd", tableBorder);
  doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(8).text("FEXA ATELIER GUARANTEE", 52, curY + 10);
  doc.font("Helvetica").fontSize(7).fillColor(textMuted);
  doc.text(
    "All flacons from Maison FEXA are formulated with rare natural absolutes, cold-macerated for optimal olfactory sillage, and sealed by hand in Grasse & Mumbai.",
    52,
    curY + 24,
    { width: notesWidth - 24, lineGap: 2 }
  );
  doc.text(
    "• Eligible unopened flacons may be returned within 7 calendar days of receipt.\n• For paid orders, eligible product cancellations are instantly credited to your FEXA Atelier Wallet.\n• Contact: concierge@fexa.com | fexa-parfums.com",
    52,
    curY + 60,
    { width: notesWidth - 24, lineGap: 2 }
  );

  // --- FOOTER ACROSS ALL BUFFERED PAGES ---
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.rect(40, 785, 515, 0.5).fill("#dcd2e6");
    doc.fillColor(textMuted).font("Helvetica").fontSize(7);
    doc.text(
      "Maison FEXA Parfums Pvt. Ltd. • Registered Atelier & Vaults • GSTIN: 27AABCF1234F1Z8",
      40,
      792,
      { width: 350 }
    );
    doc.text(`Page ${i + 1} of ${range.count}`, 400, 792, {
      align: "right",
      width: 155,
    });
  }

  doc.end();
};

/**
 * GENERATE SALES REPORT PDF
 * Streams a comprehensive analytics & financial report for authorized administrators.
 *
 * @param {Object} reportData - Compiled sales metrics, summaries, and orders
 * @param {Object} res - Express response stream
 */
export const streamSalesReportPDF = (reportData, res) => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 36,
    bufferPages: true,
  });

  const {
    periodLabel = "Custom Window",
    startDate = "N/A",
    endDate = "N/A",
    metrics = {},
    paymentMethods = [],
    productSales = [],
    orders = [],
    generatedAt = new Date(),
    adminName = "FEXA Administrator",
  } = reportData;

  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `FEXA-Sales-Report-${cleanPeriod}-${new Date().toISOString().split("T")[0]}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  doc.pipe(res);

  const primaryColor = "#161120";
  const headerPurple = "#2c1f3d";
  const textDark = "#1f172b";
  const textMuted = "#6f647d";
  const tableBorder = "#e2dbe8";
  const tableHeaderBg = "#241834";
  const rowAltBg = "#fbf9fd";

  // --- HEADER BANNER ---
  doc.rect(36, 36, 523, 62).fill(primaryColor);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(18).text("F E X A", 50, 48, {
    characterSpacing: 4,
  });
  doc.font("Helvetica").fontSize(8).fillColor("#cbb8de").text(
    "EXECUTIVE SALES & REVENUE TELEMETRY",
    50,
    70,
    { characterSpacing: 1.2 }
  );

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#f5e6cc").text(
    "FINANCIAL DISPATCH REPORT",
    350,
    48,
    { align: "right", width: 195 }
  );
  doc.font("Helvetica").fontSize(8).fillColor("#dcd2e6").text(
    `Window: ${periodLabel}`,
    350,
    64,
    { align: "right", width: 195 }
  );
  doc.font("Helvetica").fontSize(7).fillColor("#cbb8de").text(
    `Generated: ${formatDateTime(generatedAt)} by ${adminName}`,
    350,
    76,
    { align: "right", width: 195 }
  );

  let curY = 110;

  // --- 4 KEY EXECUTIVE KPI METRIC CARDS ---
  const cardW = 124;
  const cardH = 50;
  const cards = [
    { label: "NET REALIZED REVENUE", val: formatCurrency(metrics.netSales || 0), sub: "Excludes cancellations/refunds" },
    { label: "SUCCESSFUL ORDERS", val: String(metrics.completedOrders || 0), sub: `Out of ${metrics.totalOrders || 0} total orders` },
    { label: "DISCOUNTS ABSORPTION", val: formatCurrency((metrics.productDiscounts || 0) + (metrics.couponDiscounts || 0)), sub: `Coupons: ${formatCurrency(metrics.couponDiscounts || 0)}` },
    { label: "PROCESSED REFUNDS", val: formatCurrency(metrics.totalRefunds || 0), sub: `${metrics.cancelledOrders || 0} cancellations` },
  ];

  cards.forEach((c, idx) => {
    const cx = 36 + idx * (cardW + 9);
    doc.rect(cx, curY, cardW, cardH).fillAndStroke("#fdfcfe", tableBorder);
    doc.fillColor(textMuted).font("Helvetica-Bold").fontSize(6.5).text(c.label, cx + 8, curY + 7);
    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(11).text(c.val, cx + 8, curY + 19);
    doc.fillColor(textMuted).font("Helvetica").fontSize(6).text(c.sub, cx + 8, curY + 36, { width: cardW - 16, ellipsis: true });
  });

  curY += 62;

  // --- PAYMENT METHOD BREAKDOWN ---
  doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(10).text("1. PAYMENT GATEWAY RECONCILIATION", 36, curY);
  curY += 14;

  doc.rect(36, curY, 523, 18).fill(tableHeaderBg);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5);
  doc.text("PAYMENT CHANNEL", 46, curY + 5);
  doc.text("SUCCESSFUL ORDERS", 200, curY + 5, { width: 110, align: "center" });
  doc.text("REALIZED VALUE", 330, curY + 5, { width: 100, align: "right" });
  doc.text("CHANNEL SHARE", 450, curY + 5, { width: 95, align: "right" });
  curY += 18;

  const totalSalesVal = metrics.netSales || 1;
  const pmList = paymentMethods.length > 0
    ? paymentMethods
    : [
        { method: "Razorpay Online", orders: metrics.completedOrders || 0, amount: metrics.netSales || 0 },
        { method: "Cash on Delivery", orders: 0, amount: 0 },
      ];

  pmList.forEach((pm, idx) => {
    const bg = idx % 2 === 1 ? rowAltBg : "#ffffff";
    doc.rect(36, curY, 523, 16).fillAndStroke(bg, tableBorder);
    doc.fillColor(textDark).font("Helvetica").fontSize(7.5);
    doc.text(pm.method || "Other", 46, curY + 4);
    doc.text(String(pm.orders || 0), 200, curY + 4, { width: 110, align: "center" });
    doc.font("Helvetica-Bold").text(formatCurrency(pm.amount || 0), 330, curY + 4, { width: 100, align: "right" });
    const share = Math.round(((pm.amount || 0) / (totalSalesVal || 1)) * 100);
    doc.font("Helvetica").text(`${share}%`, 450, curY + 4, { width: 95, align: "right" });
    curY += 16;
  });

  curY += 16;

  // --- TOP PRODUCTS BREAKDOWN ---
  if (productSales && productSales.length > 0) {
    if (curY > 640) {
      doc.addPage();
      curY = 36;
    }

    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(10).text("2. FRAGRANCE PRODUCT DISPATCH SUMMARY", 36, curY);
    curY += 14;

    doc.rect(36, curY, 523, 18).fill(tableHeaderBg);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5);
    doc.text("PRODUCT / FLACON", 46, curY + 5);
    doc.text("CATEGORY", 230, curY + 5);
    doc.text("UNITS SOLD", 330, curY + 5, { width: 60, align: "center" });
    doc.text("NET REVENUE", 420, curY + 5, { width: 125, align: "right" });
    curY += 18;

    productSales.slice(0, 8).forEach((prod, idx) => {
      if (curY > 730) {
        doc.addPage();
        curY = 36;
      }
      const bg = idx % 2 === 1 ? rowAltBg : "#ffffff";
      doc.rect(36, curY, 523, 16).fillAndStroke(bg, tableBorder);
      doc.fillColor(textDark).font("Helvetica-Bold").fontSize(7.5);
      doc.text(prod.name || "Fragrance Flacon", 46, curY + 4, { width: 175, ellipsis: true });
      doc.font("Helvetica").fillColor(textMuted).text(prod.category || "Atelier", 230, curY + 4, { width: 90, ellipsis: true });
      doc.fillColor(textDark).text(String(prod.quantity || prod.unitsSold || 0), 330, curY + 4, { width: 60, align: "center" });
      doc.font("Helvetica-Bold").text(formatCurrency(prod.revenue || prod.netRevenue || 0), 420, curY + 4, { width: 125, align: "right" });
      curY += 16;
    });

    curY += 16;
  }

  // --- DETAILED ORDERS MANIFEST ---
  if (curY > 600) {
    doc.addPage();
    curY = 36;
  }

  doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(10).text("3. ORDER TRANSACTION AUDIT TRAIL", 36, curY);
  curY += 14;

  const drawOrderHeader = (y) => {
    doc.rect(36, y, 523, 18).fill(tableHeaderBg);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7);
    doc.text("ORDER #", 44, y + 5);
    doc.text("DATE", 120, y + 5);
    doc.text("CUSTOMER", 185, y + 5);
    doc.text("PAYMENT", 295, y + 5);
    doc.text("STATUS", 370, y + 5);
    doc.text("NET REVENUE", 450, y + 5, { width: 95, align: "right" });
  };

  drawOrderHeader(curY);
  curY += 18;

  const displayOrders = orders.slice(0, 40); // Print up to 40 records with automatic pagination
  displayOrders.forEach((o, idx) => {
    if (curY > 740) {
      doc.addPage();
      curY = 36;
      drawOrderHeader(curY);
      curY += 18;
    }

    const bg = idx % 2 === 1 ? rowAltBg : "#ffffff";
    doc.rect(36, curY, 523, 16).fillAndStroke(bg, tableBorder);

    doc.fillColor(textDark).font("Helvetica-Bold").fontSize(7);
    doc.text(o.orderNumber || "ORD-000", 44, curY + 4, { width: 70, ellipsis: true });
    doc.font("Helvetica").fillColor(textMuted).text(formatDateOnly(o.createdAt), 120, curY + 4);
    doc.fillColor(textDark).text(o.customerName || o.user?.name || "Patron", 185, curY + 4, { width: 100, ellipsis: true });
    doc.text(o.paymentMethod || "Razorpay", 295, curY + 4, { width: 70, ellipsis: true });

    const isSuccess = o.paymentStatus === "Paid" && o.orderStatus !== "Cancelled";
    doc.font("Helvetica-Bold").fillColor(isSuccess ? "#057a55" : o.orderStatus === "Cancelled" ? "#991b1b" : "#b43403");
    doc.text(o.orderStatus || "Processing", 370, curY + 4, { width: 70, ellipsis: true });

    doc.fillColor(textDark).font("Helvetica-Bold").text(formatCurrency(o.netRevenue !== undefined ? o.netRevenue : o.totalAmount), 450, curY + 4, { width: 95, align: "right" });

    curY += 16;
  });

  // --- FOOTER ACROSS ALL BUFFERED PAGES ---
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.rect(36, 792, 523, 0.5).fill("#dcd2e6");
    doc.fillColor(textMuted).font("Helvetica").fontSize(6.5);
    doc.text(
      "CONFIDENTIAL • FEXA Internal Management Telemetry • Strictly for authorized leadership and auditing.",
      36,
      798,
      { width: 380 }
    );
    doc.text(`Page ${i + 1} of ${range.count}`, 420, 798, {
      align: "right",
      width: 139,
    });
  }

  doc.end();
};

export default {
  streamOrderInvoicePDF,
  streamSalesReportPDF,
  formatCurrency,
  formatDateTime,
  formatDateOnly,
};

