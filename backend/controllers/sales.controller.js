import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Category from "../models/category.model.js";
import { normalizeOrderWithAllocations } from "../utils/couponAllocation.js";
import { streamSalesReportPDF } from "../services/pdf.service.js";
import { resolveImageUrl } from "../services/imageResolver.service.js";

// =========================================================================
// HELPER: DATE RANGE PARSER
// Returns { start, end, prevStart, prevEnd, periodLabel }
// Ensures end date includes the entire final millisecond (23:59:59.999)
// =========================================================================
const parseDateRange = (period = "thisMonth", customStart, customEnd) => {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);
  let periodLabel = "This Month";

  switch (period) {
    case "today": {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      periodLabel = "Today";
      break;
    }
    case "yesterday": {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
      periodLabel = "Yesterday";
      break;
    }
    case "last7days": {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      periodLabel = "Last 7 Days";
      break;
    }
    case "last30days": {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      periodLabel = "Last 30 Days";
      break;
    }
    case "thisMonth": {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      periodLabel = "This Month";
      break;
    }
    case "lastMonth":
    case "prevMonth": {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      periodLabel = "Last Month";
      break;
    }
    case "thisYear": {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      periodLabel = "This Year";
      break;
    }
    case "custom": {
      if (customStart) {
        start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      }

      if (customEnd) {
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
      } else {
        end.setHours(23, 59, 59, 999);
      }

      if (isNaN(start.getTime())) start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      if (isNaN(end.getTime())) end = new Date(now);

      if (start > end) {
        const temp = new Date(start);
        start = new Date(end);
        start.setHours(0, 0, 0, 0);
        end = temp;
        end.setHours(23, 59, 59, 999);
      }

      periodLabel = `${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]}`;
      break;
    }
    default: {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      periodLabel = "This Month";
      break;
    }
  }

  // Calculate equivalent previous comparison duration
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  return { start, end, prevStart, prevEnd, periodLabel };
};

// =========================================================================
// REVENUE & SALE DEFINITION CRITERIA
// 1. Failed payments (paymentStatus: 'Failed') must NEVER be counted as revenue.
// 2. Cancelled orders (orderStatus: 'Cancelled') must NEVER be counted as active sales.
// 3. Pending Razorpay orders (paymentMethod: 'Razorpay', paymentStatus: 'Pending')
//    are incomplete online checkouts and must NEVER be counted as recognized revenue.
// 4. Recognized Paid Revenue = Verified Paid Razorpay + Delivered COD.
// 5. Eligible Orders = All non-failed, non-cancelled orders undergoing fulfillment or completed.
// =========================================================================
const getBaseSalesFilter = (start, end) => ({
  createdAt: { $gte: start, $lte: end },
});

// Eligible orders match condition (excludes Failed payments and Cancelled orders)
const getEligibleOrdersMatch = (start, end) => ({
  createdAt: { $gte: start, $lte: end },
  paymentStatus: { $ne: "Failed" },
  orderStatus: { $ne: "Cancelled" },
});

// Recognized paid sales match condition (payment verified or COD delivered)
const getRecognizedSalesMatch = (start, end) => ({
  createdAt: { $gte: start, $lte: end },
  orderStatus: { $ne: "Cancelled" },
  $or: [
    { paymentStatus: "Paid" },
    { paymentMethod: "COD", orderStatus: "Delivered" },
  ],
});

// Helper to round currency amounts safely to 2 decimal places
const roundToPaise = (val) => Math.round(Number(val || 0) * 100) / 100;

// =========================================================================
// 1. GET SALES OVERVIEW
// Calculates all top-level KPI cards and previous-period growth
// =========================================================================
const getSalesOverview = async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const { start, end, prevStart, prevEnd, periodLabel } = parseDateRange(period, startDate, endDate);

    // Condition identifying a recognized paid / delivered order
    const isRecognizedCond = {
      $and: [
        { $ne: ["$orderStatus", "Cancelled"] },
        {
          $or: [
            { $eq: ["$paymentStatus", "Paid"] },
            {
              $and: [
                { $eq: ["$paymentMethod", "COD"] },
                { $eq: ["$orderStatus", "Delivered"] },
              ],
            },
          ],
        },
      ],
    };

    // Current period aggregation across all orders in range
    const [currentStats] = await Order.aggregate([
      { $match: getBaseSalesFilter(start, end) },
      {
        $group: {
          _id: null,
          totalAllOrders: { $sum: 1 },

          // Successful Orders (Recognized Paid or COD Delivered)
          successfulOrdersCount: {
            $sum: { $cond: [isRecognizedCond, 1, 0] },
          },
          successfulPaymentsAmount: {
            $sum: { $cond: [isRecognizedCond, "$totalAmount", 0] },
          },

          // Total Refunds disbursed across all orders in period
          totalRefunds: {
            $sum: { $ifNull: ["$totalRefundedAmount", 0] },
          },

          // Net Revenue: Realized revenue minus refunds
          totalNetRevenue: {
            $sum: {
              $cond: [
                isRecognizedCond,
                {
                  $max: [
                    0,
                    { $subtract: ["$totalAmount", { $ifNull: ["$totalRefundedAmount", 0] }] },
                  ],
                },
                0,
              ],
            },
          },

          // Gross Product Sales (catalogue value before offer & coupon discounts)
          totalGrossProductSales: {
            $sum: {
              $cond: [
                { $ne: ["$orderStatus", "Cancelled"] },
                {
                  $ifNull: [
                    "$originalSubtotal",
                    { $add: ["$subtotal", { $ifNull: ["$totalOfferDiscount", 0] }] },
                  ],
                },
                0,
              ],
            },
          },

          // Automatic Offer Discounts (product / category level)
          automaticOfferDiscounts: {
            $sum: {
              $cond: [
                { $ne: ["$orderStatus", "Cancelled"] },
                { $ifNull: ["$totalOfferDiscount", 0] },
                0,
              ],
            },
          },

          // Coupon Discounts
          couponDiscounts: {
            $sum: {
              $cond: [
                { $ne: ["$orderStatus", "Cancelled"] },
                { $ifNull: ["$discountAmount", 0] },
                0,
              ],
            },
          },
          couponRedemptionsCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$orderStatus", "Cancelled"] },
                    { $gt: [{ $ifNull: ["$discountAmount", 0] }, 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },

          // Shipping Revenue on recognized orders
          totalShippingRevenue: {
            $sum: {
              $cond: [isRecognizedCond, { $ifNull: ["$shippingCost", 0] }, 0],
            },
          },

          // Pending Payments (non-cancelled, not yet paid/delivered, not failed)
          pendingPaymentsAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$orderStatus", "Cancelled"] },
                    { $ne: ["$paymentStatus", "Failed"] },
                    {
                      $or: [
                        {
                          $and: [
                            { $ne: ["$paymentMethod", "COD"] },
                            { $ne: ["$paymentStatus", "Paid"] },
                          ],
                        },
                        {
                          $and: [
                            { $eq: ["$paymentMethod", "COD"] },
                            { $ne: ["$orderStatus", "Delivered"] },
                            { $ne: ["$paymentStatus", "Paid"] },
                          ],
                        },
                      ],
                    },
                  ],
                },
                "$totalAmount",
                0,
              ],
            },
          },
          pendingPaymentsCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$orderStatus", "Cancelled"] },
                    { $ne: ["$paymentStatus", "Failed"] },
                    {
                      $or: [
                        {
                          $and: [
                            { $ne: ["$paymentMethod", "COD"] },
                            { $ne: ["$paymentStatus", "Paid"] },
                          ],
                        },
                        {
                          $and: [
                            { $eq: ["$paymentMethod", "COD"] },
                            { $ne: ["$orderStatus", "Delivered"] },
                            { $ne: ["$paymentStatus", "Paid"] },
                          ],
                        },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },

          // Cancelled Orders
          cancelledOrdersAmount: {
            $sum: {
              $cond: [{ $eq: ["$orderStatus", "Cancelled"] }, "$totalAmount", 0],
            },
          },
          cancelledOrdersCount: {
            $sum: {
              $cond: [{ $eq: ["$orderStatus", "Cancelled"] }, 1, 0],
            },
          },

          // Failed Payments
          failedPaymentsAmount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Failed"] }, "$totalAmount", 0],
            },
          },
          failedPaymentsCount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Failed"] }, 1, 0],
            },
          },

          // Returned / Refunded Orders
          returnedOrdersCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $in: ["$orderStatus", ["Returned", "Refunded", "Return Approved"]] },
                    { $gt: [{ $ifNull: ["$totalRefundedAmount", 0] }, 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          returnedOrdersAmount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $in: ["$orderStatus", ["Returned", "Refunded", "Return Approved"]] },
                    { $gt: [{ $ifNull: ["$totalRefundedAmount", 0] }, 0] },
                  ],
                },
                { $ifNull: ["$totalRefundedAmount", 0] },
                0,
              ],
            },
          },
        },
      },
    ]);

    // Units Sold on Eligible Orders (unwind items)
    const [unitsResult] = await Order.aggregate([
      { $match: getEligibleOrdersMatch(start, end) },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          totalUnitsSold: { $sum: "$items.quantity" },
        },
      },
    ]);

    // Previous Period Aggregation for Comparison (Growth Calculation)
    const [prevStats] = await Order.aggregate([
      { $match: getBaseSalesFilter(prevStart, prevEnd) },
      {
        $group: {
          _id: null,
          totalNetRevenue: {
            $sum: {
              $cond: [
                isRecognizedCond,
                {
                  $max: [
                    0,
                    { $subtract: ["$totalAmount", { $ifNull: ["$totalRefundedAmount", 0] }] },
                  ],
                },
                0,
              ],
            },
          },
          successfulOrdersCount: {
            $sum: { $cond: [isRecognizedCond, 1, 0] },
          },
        },
      },
    ]);

    const stats = currentStats || {
      totalAllOrders: 0,
      successfulOrdersCount: 0,
      successfulPaymentsAmount: 0,
      totalRefunds: 0,
      totalNetRevenue: 0,
      totalGrossProductSales: 0,
      automaticOfferDiscounts: 0,
      couponDiscounts: 0,
      couponRedemptionsCount: 0,
      totalShippingRevenue: 0,
      pendingPaymentsAmount: 0,
      pendingPaymentsCount: 0,
      cancelledOrdersAmount: 0,
      cancelledOrdersCount: 0,
      failedPaymentsAmount: 0,
      failedPaymentsCount: 0,
      returnedOrdersCount: 0,
      returnedOrdersAmount: 0,
    };

    const unitsSold = unitsResult?.totalUnitsSold || 0;

    // Gross Sales = Total Gross Product Sales + Total Shipping Revenue
    const totalGrossSales = roundToPaise(stats.totalGrossProductSales + stats.totalShippingRevenue);
    const totalNetRevenue = roundToPaise(stats.totalNetRevenue);
    const totalDiscounts = roundToPaise(stats.couponDiscounts + stats.automaticOfferDiscounts);
    const couponDiscounts = roundToPaise(stats.couponDiscounts);
    const automaticOfferDiscounts = roundToPaise(stats.automaticOfferDiscounts);
    const totalShippingRevenue = roundToPaise(stats.totalShippingRevenue);
    const totalRefunds = roundToPaise(stats.totalRefunds);

    // Average Order Value calculation: Net Revenue / Successful Orders Count
    let aov = 0;
    if (stats.successfulOrdersCount > 0) {
      aov = roundToPaise(totalNetRevenue / stats.successfulOrdersCount);
    } else if (stats.totalAllOrders > 0) {
      aov = roundToPaise(totalGrossSales / stats.totalAllOrders);
    }

    // Comparison growth percentage vs previous equivalent duration
    let revenueGrowth = null;
    let ordersGrowth = null;

    if (prevStats && prevStats.totalNetRevenue > 0) {
      revenueGrowth = Number(
        (((totalNetRevenue - prevStats.totalNetRevenue) / prevStats.totalNetRevenue) * 100).toFixed(1)
      );
    } else if (prevStats && prevStats.totalNetRevenue === 0 && totalNetRevenue > 0) {
      revenueGrowth = 100;
    }

    if (prevStats && prevStats.successfulOrdersCount > 0) {
      ordersGrowth = Number(
        (((stats.successfulOrdersCount - prevStats.successfulOrdersCount) / prevStats.successfulOrdersCount) * 100).toFixed(1)
      );
    } else if (prevStats && prevStats.successfulOrdersCount === 0 && stats.successfulOrdersCount > 0) {
      ordersGrowth = 100;
    }

    return res.status(200).json({
      success: true,
      data: {
        period: period || "thisMonth",
        periodLabel,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString(),
          prevStart: prevStart.toISOString(),
          prevEnd: prevEnd.toISOString(),
        },
        overview: {
          // Authoritative Financial Aggregations
          totalGrossSales,
          totalNetRevenue,
          totalOrders: stats.totalAllOrders,
          successfulOrdersCount: stats.successfulOrdersCount,
          cancelledOrdersCount: stats.cancelledOrdersCount,
          cancelledOrdersAmount: roundToPaise(stats.cancelledOrdersAmount),
          returnedOrdersCount: stats.returnedOrdersCount,
          returnedOrdersAmount: roundToPaise(stats.returnedOrdersAmount),
          totalRefunds,
          totalDiscounts,
          couponDiscounts,
          automaticOfferDiscounts,
          totalShippingRevenue,
          averageOrderValue: aov,
          unitsSold,

          // Legacy and compatibility properties
          recognizedRevenue: totalNetRevenue,
          grossOrderValue: totalGrossSales,
          netSales: totalNetRevenue,
          paidOrdersCount: stats.successfulOrdersCount,
          successfulPayments: {
            amount: roundToPaise(stats.successfulPaymentsAmount),
            count: stats.successfulOrdersCount,
          },
          pendingPayments: {
            amount: roundToPaise(stats.pendingPaymentsAmount),
            count: stats.pendingPaymentsCount,
          },
          cancelledOrders: {
            amount: roundToPaise(stats.cancelledOrdersAmount),
            count: stats.cancelledOrdersCount,
          },
          failedPayments: {
            amount: roundToPaise(stats.failedPaymentsAmount),
            count: stats.failedPaymentsCount,
          },
          coupons: {
            totalDiscountAmount: couponDiscounts,
            redemptionsCount: stats.couponRedemptionsCount,
          },
          offers: {
            totalDiscountAmount: automaticOfferDiscounts,
          },
          growth: {
            revenueGrowth,
            ordersGrowth,
            previousRevenue: prevStats?.totalNetRevenue || 0,
            previousOrders: prevStats?.successfulOrdersCount || 0,
          },
        },
      },
    });
  } catch (error) {
    console.error("Sales overview error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate sales overview.",
      error: error.message,
    });
  }
};

// =========================================================================
// 2. GET SALES TRENDS (TIME-SERIES CHART)
// Groups by day or month and fills gaps with 0s so charts are contiguous
// =========================================================================
const getSalesTrends = async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const { start, end } = parseDateRange(period, startDate, endDate);

    const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const isYearlyOrLong = diffDays > 90;

    // Group format
    const dateFormat = isYearlyOrLong ? "%Y-%m" : "%Y-%m-%d";

    const isRecognizedCond = {
      $and: [
        { $ne: ["$orderStatus", "Cancelled"] },
        {
          $or: [
            { $eq: ["$paymentStatus", "Paid"] },
            {
              $and: [
                { $eq: ["$paymentMethod", "COD"] },
                { $eq: ["$orderStatus", "Delivered"] },
              ],
            },
          ],
        },
      ],
    };

    const trendsData = await Order.aggregate([
      { $match: getBaseSalesFilter(start, end) },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          orderCount: { $sum: 1 },
          successfulOrders: { $sum: { $cond: [isRecognizedCond, 1, 0] } },
          recognizedRevenue: {
            $sum: {
              $cond: [
                isRecognizedCond,
                {
                  $max: [
                    0,
                    { $subtract: ["$totalAmount", { $ifNull: ["$totalRefundedAmount", 0] }] },
                  ],
                },
                0,
              ],
            },
          },
          grossValue: {
            $sum: {
              $cond: [
                { $ne: ["$orderStatus", "Cancelled"] },
                {
                  $add: [
                    {
                      $ifNull: [
                        "$originalSubtotal",
                        { $add: ["$subtotal", { $ifNull: ["$totalOfferDiscount", 0] }] },
                      ],
                    },
                    { $ifNull: ["$shippingCost", 0] },
                  ],
                },
                0,
              ],
            },
          },
          discounts: {
            $sum: {
              $cond: [
                { $ne: ["$orderStatus", "Cancelled"] },
                {
                  $add: [
                    { $ifNull: ["$discountAmount", 0] },
                    { $ifNull: ["$totalOfferDiscount", 0] },
                  ],
                },
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Build contiguous date map
    const map = new Map();
    trendsData.forEach((row) => {
      map.set(row._id, {
        revenue: roundToPaise(row.recognizedRevenue),
        orderCount: row.orderCount,
        successfulOrders: row.successfulOrders,
        grossValue: roundToPaise(row.grossValue),
        discounts: roundToPaise(row.discounts),
      });
    });

    const series = [];
    if (isYearlyOrLong) {
      // Iterate months
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor <= end) {
        const year = cursor.getFullYear();
        const month = String(cursor.getMonth() + 1).padStart(2, "0");
        const key = `${year}-${month}`;
        const data = map.get(key) || { revenue: 0, orderCount: 0, successfulOrders: 0, grossValue: 0, discounts: 0 };
        const label = cursor.toLocaleString("en-US", { month: "short", year: "numeric" });

        series.push({
          key,
          label,
          revenue: data.revenue,
          netRevenue: data.revenue,
          orderCount: data.orderCount,
          successfulOrders: data.successfulOrders,
          grossValue: data.grossValue,
          discounts: data.discounts,
        });

        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      // Iterate days
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);

      while (cursor <= end) {
        const year = cursor.getFullYear();
        const month = String(cursor.getMonth() + 1).padStart(2, "0");
        const day = String(cursor.getDate()).padStart(2, "0");
        const key = `${year}-${month}-${day}`;
        const data = map.get(key) || { revenue: 0, orderCount: 0, successfulOrders: 0, grossValue: 0, discounts: 0 };
        const label = cursor.toLocaleString("en-US", { month: "short", day: "numeric" });

        series.push({
          key,
          label,
          revenue: data.revenue,
          netRevenue: data.revenue,
          orderCount: data.orderCount,
          successfulOrders: data.successfulOrders,
          grossValue: data.grossValue,
          discounts: data.discounts,
        });

        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        interval: isYearlyOrLong ? "monthly" : "daily",
        series,
      },
    });
  } catch (error) {
    console.error("Sales trends error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate sales trends.",
      error: error.message,
    });
  }
};

// =========================================================================
// 3. GET PRODUCT PERFORMANCE (VARIANT-LEVEL REPORTING)
// Distinguishes 30ml, 50ml, 100ml, 200ml variants
// =========================================================================
const getProductPerformance = async (req, res) => {
  try {
    const { period, startDate, endDate, sortBy = "unitsSold", sortOrder = "desc", page = 1, limit = 10 } = req.query;
    const { start, end } = parseDateRange(period, startDate, endDate);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const sortDir = sortOrder === "asc" ? 1 : -1;
    const sortField = ["unitsSold", "grossSales", "netSales", "name"].includes(sortBy)
      ? sortBy
      : "unitsSold";

    const pipeline = [
      { $match: getEligibleOrdersMatch(start, end) },
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            name: "$items.name",
            volumeMl: "$items.volumeMl",
            category: { $ifNull: ["$items.category", "Unisex"] },
            brand: { $ifNull: ["$items.brand", "FEXA"] },
          },
          image: { $first: "$items.image" },
          productId: { $first: "$items.product" },
          variantId: { $first: "$items.variantId" },
          unitsSold: { $sum: "$items.quantity" },
          returnedQuantity: { $sum: { $ifNull: ["$items.returnedQuantity", 0] } },
          refundedAmount: { $sum: { $ifNull: ["$items.refundAmount", 0] } },
          grossSales: { $sum: "$items.lineTotal" },
          ordersCount: { $addToSet: "$_id" },
          unitPrices: { $addToSet: "$items.unitPrice" },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id.name",
          volumeMl: "$_id.volumeMl",
          category: "$_id.category",
          brand: "$_id.brand",
          image: 1,
          productId: 1,
          variantId: 1,
          unitsSold: 1,
          returnedQuantity: 1,
          netUnitsSold: { $max: [0, { $subtract: ["$unitsSold", "$returnedQuantity"] }] },
          grossSales: 1,
          refundedAmount: 1,
          netSales: { $max: [0, { $subtract: ["$grossSales", "$refundedAmount"] }] },
          ordersCount: { $size: "$ordersCount" },
          averageUnitPrice: { $avg: "$unitPrices" },
        },
      },
      { $sort: { [sortField]: sortDir } },
    ];

    const allVariants = await Order.aggregate(pipeline);
    
    const totalVariants = allVariants.length;const paginatedVariants = await Promise.all(
  allVariants.slice(skip, skip + limitNum).map(async (variant) => ({
    ...variant,
    image: (await resolveImageUrl(variant.image)) || null,
  }))
);

    return res.status(200).json({
      success: true,
      data: {
        products: paginatedVariants,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalVariants,
          totalPages: Math.ceil(totalVariants / limitNum) || 1,
        },
      },
    });
  } catch (error) {
    console.error("Product performance error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate product performance.",
      error: error.message,
    });
  }
};

// =========================================================================
// 4. GET CATEGORY PERFORMANCE
// Dynamic category breakdown without double-counting
// =========================================================================
const getCategoryPerformance = async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const { start, end } = parseDateRange(period, startDate, endDate);

    // Fetch dynamic categories from Category collection
    const dbCategories = await Category.find({ isActive: true }).select("name").lean();
    const knownCategoryNames = new Set(["Men", "Women", "Unisex"]);
    dbCategories.forEach((c) => {
      if (c.name && c.name.trim()) knownCategoryNames.add(c.name.trim());
    });

    const categoriesData = await Order.aggregate([
      { $match: getEligibleOrdersMatch(start, end) },
      { $unwind: "$items" },
      {
        $group: {
          _id: { $ifNull: ["$items.category", "Unisex"] },
          unitsSold: { $sum: "$items.quantity" },
          grossSales: { $sum: "$items.lineTotal" },
          returnedQuantity: { $sum: { $ifNull: ["$items.returnedQuantity", 0] } },
          refundedAmount: { $sum: { $ifNull: ["$items.refundAmount", 0] } },
          orderIds: { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          category: "$_id",
          unitsSold: 1,
          grossSales: 1,
          netSales: { $max: [0, { $subtract: ["$grossSales", "$refundedAmount"] }] },
          returnedQuantity: 1,
          refundedAmount: 1,
          ordersCount: { $size: "$orderIds" },
          _id: 0,
        },
      },
      { $sort: { grossSales: -1 } },
    ]);

    const resultMap = new Map(categoriesData.map((c) => [c.category, c]));

    let totalGross = 0;
    let totalNet = 0;

    const categories = Array.from(knownCategoryNames).map((catName) => {
      const existing = resultMap.get(catName) || {
        category: catName,
        unitsSold: 0,
        grossSales: 0,
        netSales: 0,
        returnedQuantity: 0,
        refundedAmount: 0,
        ordersCount: 0,
      };
      totalGross += existing.grossSales;
      totalNet += existing.netSales;
      return existing;
    });

    // Add any non-standard categories that exist in actual order items
    categoriesData.forEach((c) => {
      if (!knownCategoryNames.has(c.category)) {
        categories.push(c);
        totalGross += c.grossSales;
        totalNet += c.netSales;
      }
    });

    // Add percentage shares
    const categoriesWithShares = categories.map((c) => ({
      ...c,
      sharePercentage: totalGross > 0 ? Number(((c.grossSales / totalGross) * 100).toFixed(1)) : 0,
    }));

    return res.status(200).json({
      success: true,
      data: {
        categories: categoriesWithShares,
        totalGrossSales: roundToPaise(totalGross),
        totalNetSales: roundToPaise(totalNet),
      },
    });
  } catch (error) {
    console.error("Category performance error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate category performance.",
      error: error.message,
    });
  }
};

// =========================================================================
// 5. GET PAYMENT METHOD BREAKDOWN
// Razorpay vs FEXA Wallet vs Cash on Delivery
// =========================================================================
const getPaymentMethodBreakdown = async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const { start, end } = parseDateRange(period, startDate, endDate);

    const orders = await Order.find(getBaseSalesFilter(start, end))
      .select("paymentMethod paymentStatus orderStatus totalAmount totalRefundedAmount")
      .lean();

    const breakdown = {
      razorpay: {
        successful: { count: 0, amount: 0 },
        pending: { count: 0, amount: 0 },
        failed: { count: 0, amount: 0 },
        refunded: { count: 0, amount: 0 },
        cancelled: { count: 0, amount: 0 },
      },
      wallet: {
        successful: { count: 0, amount: 0 },
        pending: { count: 0, amount: 0 },
        failed: { count: 0, amount: 0 },
        refunded: { count: 0, amount: 0 },
        cancelled: { count: 0, amount: 0 },
      },
      cod: {
        successful: { count: 0, amount: 0 },
        pending: { count: 0, amount: 0 },
        failed: { count: 0, amount: 0 },
        refunded: { count: 0, amount: 0 },
        cancelled: { count: 0, amount: 0 },
      },
    };

    orders.forEach((o) => {
      const pm = (o.paymentMethod || "").toLowerCase();
      const methodKey = pm === "cod" ? "cod" : pm === "wallet" ? "wallet" : "razorpay";
      const target = breakdown[methodKey];
      const amount = Number(o.totalAmount || 0);
      const refundAmt = Number(o.totalRefundedAmount || 0);

      if (refundAmt > 0) {
        target.refunded.count += 1;
        target.refunded.amount = roundToPaise(target.refunded.amount + refundAmt);
      }

      if (o.orderStatus === "Cancelled") {
        target.cancelled.count += 1;
        target.cancelled.amount = roundToPaise(target.cancelled.amount + amount);
        return;
      }

      if (o.paymentStatus === "Failed") {
        target.failed.count += 1;
        target.failed.amount = roundToPaise(target.failed.amount + amount);
        return;
      }

      if (o.paymentStatus === "Paid" || (methodKey === "cod" && o.orderStatus === "Delivered")) {
        target.successful.count += 1;
        target.successful.amount = roundToPaise(target.successful.amount + amount);
      } else {
        target.pending.count += 1;
        target.pending.amount = roundToPaise(target.pending.amount + amount);
      }
    });

    const totalCollected = roundToPaise(
      breakdown.razorpay.successful.amount +
      breakdown.wallet.successful.amount +
      breakdown.cod.successful.amount -
      (breakdown.razorpay.refunded.amount + breakdown.wallet.refunded.amount + breakdown.cod.refunded.amount)
    );

    const cancelledSummary = {
      count: breakdown.razorpay.cancelled.count + breakdown.wallet.cancelled.count + breakdown.cod.cancelled.count,
      amount: roundToPaise(breakdown.razorpay.cancelled.amount + breakdown.wallet.cancelled.amount + breakdown.cod.cancelled.amount),
    };

    return res.status(200).json({
      success: true,
      data: {
        totalCollected,
        methods: {
          // Structured buckets by payment gateway / system
          razorpay: breakdown.razorpay,
          wallet: breakdown.wallet,
          cod: breakdown.cod,

          // Backwards compatibility mappings for existing UI
          razorpayPaid: breakdown.razorpay.successful,
          razorpayPending: breakdown.razorpay.pending,
          razorpayFailed: breakdown.razorpay.failed,
          walletPaid: breakdown.wallet.successful,
          walletPending: breakdown.wallet.pending,
          walletFailed: breakdown.wallet.failed,
          codDelivered: breakdown.cod.successful,
          codInTransit: breakdown.cod.pending,
          cancelledOrders: cancelledSummary,
        },
      },
    });
  } catch (error) {
    console.error("Payment method breakdown error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate payment breakdown.",
      error: error.message,
    });
  }
};

// =========================================================================
// 6. GET COUPON PERFORMANCE
// Tracks coupon discounts, redemptions, associated sales
// =========================================================================
const getCouponPerformance = async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const { start, end } = parseDateRange(period, startDate, endDate);

    const couponStats = await Order.aggregate([
      {
        $match: {
          ...getEligibleOrdersMatch(start, end),
          couponCode: { $ne: null, $exists: true },
        },
      },
      {
        $group: {
          _id: "$couponCode",
          couponName: { $first: "$couponName" },
          discountPercentage: { $first: "$discountPercentage" },
          redemptionsCount: { $sum: 1 },
          totalDiscountGranted: { $sum: "$discountAmount" },
          associatedGrossSales: { $sum: "$subtotal" },
          associatedFinalRevenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { redemptionsCount: -1 } },
    ]);

    const formattedCoupons = couponStats.map((c) => ({
      code: c._id,
      name: c.couponName || "Privilege Code",
      discountPercentage: c.discountPercentage,
      redemptionsCount: c.redemptionsCount,
      totalDiscountGranted: c.totalDiscountGranted,
      associatedGrossSales: c.associatedGrossSales,
      associatedFinalRevenue: c.associatedFinalRevenue,
    }));

    return res.status(200).json({
      success: true,
      data: {
        coupons: formattedCoupons,
      },
    });
  } catch (error) {
    console.error("Coupon performance error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate coupon analytics.",
      error: error.message,
    });
  }
};

// =========================================================================
// 7. GET DETAILED SALES REPORT TABLE
// Paginated, searchable, and filterable list of individual order records
// =========================================================================
const getDetailedSalesReport = async (req, res) => {
  try {
    const {
      period,
      startDate,
      endDate,
      search,
      orderStatus,
      paymentStatus,
      paymentMethod,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    const { start, end } = parseDateRange(period, startDate, endDate);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Base query with date range
    const filter = {
      createdAt: { $gte: start, $lte: end },
    };

    if (orderStatus && orderStatus !== "All") {
      filter.orderStatus = orderStatus;
    }

    if (paymentStatus && paymentStatus !== "All") {
      filter.paymentStatus = paymentStatus;
    }

    if (paymentMethod && paymentMethod !== "All") {
      filter.paymentMethod = paymentMethod;
    }

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { orderNumber: { $regex: term, $options: "i" } },
        { couponCode: { $regex: term, $options: "i" } },
        { "shippingAddress.fullName": { $regex: term, $options: "i" } },
        { "shippingAddress.phone": { $regex: term, $options: "i" } },
      ];
    }

    const sortOptions = {};
    const validSortFields = ["createdAt", "totalAmount", "subtotal", "orderNumber"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;

    const [orders, totalOrders] = await Promise.all([
      Order.find(filter)
        .populate("user", "name email")
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filter),
    ]);

    // Format orders safely for admin reporting
    const formattedOrders = orders.map((o) => {
      const normalizedOrder = normalizeOrderWithAllocations(o);
      const totalUnits = (o.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
      const itemsSummary = (o.items || []).map((it) => `${it.name} (${it.volumeMl}ml × ${it.quantity})`).join(", ");
      const sizesSummary = [...new Set((o.items || []).map((it) => `${it.volumeMl}ml`))].join(", ");

      const customerName =
        o.shippingAddress?.fullName ||
        o.user?.name ||
        (o.user?.email ? o.user.email.split("@")[0] : "Customer");

      return {
        _id: o._id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        customerName,
        customerEmail: o.user?.email || "N/A",
        customerPhone: o.shippingAddress?.phone || "N/A",
        shippingAddress: o.shippingAddress || null,
        itemsSummary,
        sizesSummary,
        totalUnits,
        subtotal: o.subtotal,
        couponCode: o.couponCode || null,
        couponName: o.couponName || null,
        discountPercentage: o.discountPercentage || 0,
        discountAmount: o.discountAmount || 0,
        shippingCost: o.shippingCost || 0,
        totalAmount: o.totalAmount,
        totalRefundedAmount: o.totalRefundedAmount || 0,
        hasReturns: o.hasReturns || false,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        orderStatus: o.orderStatus,
        razorpayOrderId: o.razorpayOrderId || null,
        razorpayPaymentId: o.razorpayPaymentId || null,
        items: normalizedOrder.items,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        orders: formattedOrders,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalOrders,
          totalPages: Math.ceil(totalOrders / limitNum) || 1,
        },
      },
    });
  } catch (error) {
    console.error("Detailed sales report error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate sales report table.",
      error: error.message,
    });
  }
};

// =========================================================================
// 8. EXPORT SALES REPORT (CSV)
// Generates clean CSV matching active date range and applied filters
// =========================================================================
const exportSalesReportCSV = async (req, res) => {
  try {
    const {
      period,
      startDate,
      endDate,
      orderStatus,
      paymentStatus,
      paymentMethod,
      search,
    } = req.query;

    const { start, end, periodLabel } = parseDateRange(period, startDate, endDate);

    const filter = {
      createdAt: { $gte: start, $lte: end },
    };

    if (orderStatus && orderStatus !== "All") filter.orderStatus = orderStatus;
    if (paymentStatus && paymentStatus !== "All") filter.paymentStatus = paymentStatus;
    if (paymentMethod && paymentMethod !== "All") filter.paymentMethod = paymentMethod;

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { orderNumber: { $regex: term, $options: "i" } },
        { couponCode: { $regex: term, $options: "i" } },
        { "shippingAddress.fullName": { $regex: term, $options: "i" } },
      ];
    }

    const orders = await Order.find(filter)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // Helper to escape CSV values
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      "Order Number",
      "Order Date (UTC)",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Product Summary",
      "Perfume Sizes",
      "Total Units",
      "Catalogue Subtotal (INR)",
      "Offer Discounts (INR)",
      "Coupon Code",
      "Coupon Discount (INR)",
      "Shipping Cost (INR)",
      "Final Order Amount (INR)",
      "Total Refunded Amount (INR)",
      "Net Realized Revenue (INR)",
      "Payment Method",
      "Payment Status",
      "Order Status",
    ];

    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel
    csvContent += headers.map(escapeCsv).join(",") + "\r\n";

    orders.forEach((o) => {
      const totalUnits = (o.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
      const itemsSummary = (o.items || []).map((it) => `${it.name} (${it.volumeMl}ml x${it.quantity})`).join("; ");
      const sizesSummary = [...new Set((o.items || []).map((it) => `${it.volumeMl}ml`))].join("; ");

      const customerName =
        o.shippingAddress?.fullName ||
        o.user?.name ||
        (o.user?.email ? o.user.email.split("@")[0] : "Customer");

      const refundAmount = Number(o.totalRefundedAmount || 0);
      const isPaid = (o.paymentStatus === "Paid" && o.orderStatus !== "Cancelled") ||
        (o.paymentMethod === "COD" && o.orderStatus === "Delivered");
      const netRevenue = isPaid ? Math.max(0, (o.totalAmount || 0) - refundAmount) : 0;

      const row = [
        o.orderNumber,
        new Date(o.createdAt).toISOString().replace("T", " ").substring(0, 19),
        customerName,
        o.user?.email || "N/A",
        o.shippingAddress?.phone || "N/A",
        itemsSummary,
        sizesSummary,
        totalUnits,
        o.subtotal || 0,
        o.totalOfferDiscount || 0,
        o.couponCode || "None",
        o.discountAmount || 0,
        o.shippingCost || 0,
        o.totalAmount || 0,
        refundAmount,
        netRevenue,
        o.paymentMethod || "COD",
        o.paymentStatus || "Pending",
        o.orderStatus || "Processing",
      ];

      csvContent += row.map(escapeCsv).join(",") + "\r\n";
    });

    const filename = `FEXA_Sales_Report_${periodLabel.replace(/[^a-zA-Z0-9_-]/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export sales report error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export sales report CSV.",
      error: error.message,
    });
  }
};

// =========================================================================
// 8.5 EXPORT SALES REPORT (PDF)
// Generates luxury formatted PDF matching active date range and applied filters
// =========================================================================
const exportSalesReportPDF = async (req, res) => {
  try {
    const {
      period,
      startDate,
      endDate,
      orderStatus,
      paymentStatus,
      paymentMethod,
      search,
    } = req.query;

    const { start, end, periodLabel } = parseDateRange(period, startDate, endDate);

    const filter = {
      createdAt: { $gte: start, $lte: end },
    };

    if (orderStatus && orderStatus !== "All") filter.orderStatus = orderStatus;
    if (paymentStatus && paymentStatus !== "All") filter.paymentStatus = paymentStatus;
    if (paymentMethod && paymentMethod !== "All") filter.paymentMethod = paymentMethod;

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { orderNumber: { $regex: term, $options: "i" } },
        { couponCode: { $regex: term, $options: "i" } },
        { "shippingAddress.fullName": { $regex: term, $options: "i" } },
      ];
    }

    const orders = await Order.find(filter)
      .populate("user", "name email phone")
      .sort({ createdAt: -1 })
      .lean();

    // Compile Financial Metrics
    let grossSales = 0;
    let netSales = 0;
    let productDiscounts = 0;
    let couponDiscounts = 0;
    let totalRefunds = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let returnedOrders = 0;

    const pmMap = {};
    const prodMap = {};

    orders.forEach((o) => {
      const isRecognizedPaid =
        (o.paymentStatus === "Paid" && o.orderStatus !== "Cancelled") ||
        (o.paymentMethod === "COD" && o.orderStatus === "Delivered");

      if (o.orderStatus === "Cancelled") {
        cancelledOrders++;
      } else if (o.orderStatus === "Returned" || o.orderStatus === "Refunded") {
        returnedOrders++;
      }

      if (isRecognizedPaid) {
        completedOrders++;
        const oGross = Number(o.originalSubtotal || o.subtotal || o.totalAmount || 0);
        const oNet = Number(o.totalAmount || 0);
        grossSales += oGross;
        netSales += oNet;

        productDiscounts += Number(o.totalOfferDiscount || 0);
        couponDiscounts += Number(o.discountAmount || 0);
        totalRefunds += Number(o.totalRefundedAmount || 0);

        // Payment Method breakdown
        const pmKey = o.paymentMethod || "Other";
        if (!pmMap[pmKey]) pmMap[pmKey] = { method: pmKey, orders: 0, amount: 0 };
        pmMap[pmKey].orders++;
        pmMap[pmKey].amount += oNet;

        // Product Breakdown
        (o.items || []).forEach((it) => {
          if (it.itemStatus !== "Cancelled") {
            const pName = it.name || "Fragrance Item";
            if (!prodMap[pName]) {
              prodMap[pName] = {
                name: pName,
                category: it.category || "Atelier",
                quantity: 0,
                revenue: 0,
              };
            }
            prodMap[pName].quantity += (it.quantity || 1);
            prodMap[pName].revenue += (it.discountedLineAmount || it.lineTotal || (it.unitPrice * (it.quantity || 1)));
          }
        });
      }
    });

    const paymentMethods = Object.values(pmMap).sort((a, b) => b.amount - a.amount);
    const productSales = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue);

    const reportData = {
      periodLabel,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      metrics: {
        totalOrders: orders.length,
        completedOrders,
        cancelledOrders,
        returnedOrders,
        grossSales: Math.round(grossSales * 100) / 100,
        netSales: Math.round(Math.max(0, netSales - totalRefunds) * 100) / 100,
        productDiscounts: Math.round(productDiscounts * 100) / 100,
        couponDiscounts: Math.round(couponDiscounts * 100) / 100,
        totalRefunds: Math.round(totalRefunds * 100) / 100,
      },
      paymentMethods,
      productSales,
      orders,
      generatedAt: new Date(),
      adminName: req.admin?.name || req.user?.name || "FEXA Administrator",
    };

    streamSalesReportPDF(reportData, res);
  } catch (error) {
    console.error("Export sales report PDF error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate sales report PDF.",
        error: error.message,
      });
    }
  }
};

// =========================================================================
// GET DASHBOARD REVENUE ANALYTICS (GRAPH & SUMMARY METRICS)
// =========================================================================
const getDashboardRevenueAnalytics = async (req, res) => {
  try {
    const { period = "last7days", startDate, endDate } = req.query;
    const { start, end, prevStart, prevEnd, periodLabel } = parseDateRange(period, startDate, endDate);

    // Condition for recognized order:
    // Recognized when (orderStatus !== "Cancelled" && (paymentStatus === "Paid" || (paymentMethod === "COD" && orderStatus === "Delivered")))
    const isRecognizedOrderCond = {
      $and: [
        { $ne: ["$orderStatus", "Cancelled"] },
        {
          $or: [
            { $eq: ["$paymentStatus", "Paid"] },
            {
              $and: [
                { $eq: ["$paymentMethod", "COD"] },
                { $eq: ["$orderStatus", "Delivered"] },
              ],
            },
          ],
        },
      ],
    };

    // Gross Product Amount (Catalogue value before discounts)
    const grossAmountExpr = {
      $cond: [
        isRecognizedOrderCond,
        {
          $ifNull: [
            "$originalSubtotal",
            { $add: ["$subtotal", { $ifNull: ["$totalOfferDiscount", 0] }] },
          ],
        },
        0,
      ],
    };

    // Product Offer Discounts
    const productDiscountsExpr = {
      $cond: [
        isRecognizedOrderCond,
        { $ifNull: ["$totalOfferDiscount", 0] },
        0,
      ],
    };

    // Coupon Discounts
    const couponDiscountsExpr = {
      $cond: [
        isRecognizedOrderCond,
        { $ifNull: ["$discountAmount", 0] },
        0,
      ],
    };

    // Total Combined Discounts (Product Offers + Coupon Discounts)
    const totalDiscountsExpr = {
      $cond: [
        isRecognizedOrderCond,
        {
          $add: [
            { $ifNull: ["$totalOfferDiscount", 0] },
            { $ifNull: ["$discountAmount", 0] },
          ],
        },
        0,
      ],
    };

    // Shipping Charges
    const shippingExpr = {
      $cond: [
        isRecognizedOrderCond,
        { $ifNull: ["$shippingCost", 0] },
        0,
      ],
    };

    // Refund Amount
    const refundsExpr = {
      $cond: [
        isRecognizedOrderCond,
        { $ifNull: ["$totalRefundedAmount", 0] },
        0,
      ],
    };

    // Expression for net recognized revenue per order:
    // Uses actual final paid amount (totalAmount) after discounts and coupons, minus refunds/returns
    const recognizedRevenueExpr = {
      $cond: [
        isRecognizedOrderCond,
        {
          $max: [
            0,
            { $subtract: ["$totalAmount", { $ifNull: ["$totalRefundedAmount", 0] }] },
          ],
        },
        0,
      ],
    };

    // Expression for counting successful recognized orders
    const isSuccessfulOrderExpr = {
      $cond: [
        {
          $and: [
            isRecognizedOrderCond,
            {
              $gt: [
                {
                  $max: [
                    0,
                    { $subtract: ["$totalAmount", { $ifNull: ["$totalRefundedAmount", 0] }] },
                  ],
                },
                0,
              ],
            },
          ],
        },
        1,
        0,
      ],
    };

    // 1. Current Period Overview Aggregation
    const [currentPeriodStats] = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: recognizedRevenueExpr },
          successfulOrders: { $sum: isSuccessfulOrderExpr },
          totalGrossAmount: { $sum: grossAmountExpr },
          totalProductDiscounts: { $sum: productDiscountsExpr },
          totalCouponDiscounts: { $sum: couponDiscountsExpr },
          totalDiscounts: { $sum: totalDiscountsExpr },
          totalShipping: { $sum: shippingExpr },
          totalRefunds: { $sum: refundsExpr },
        },
      },
    ]);

    // 2. Previous Equivalent Period Aggregation (for growth comparison)
    const [prevPeriodStats] = await Order.aggregate([
      { $match: { createdAt: { $gte: prevStart, $lte: prevEnd } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: recognizedRevenueExpr },
          successfulOrders: { $sum: isSuccessfulOrderExpr },
        },
      },
    ]);

    const totalRevenue = Math.round((currentPeriodStats?.totalRevenue || 0) * 100) / 100;
    const successfulOrders = currentPeriodStats?.successfulOrders || 0;
    const averageOrderValue = successfulOrders > 0 ? Math.round((totalRevenue / successfulOrders) * 100) / 100 : 0;

    const prevRevenue = Math.round((prevPeriodStats?.totalRevenue || 0) * 100) / 100;
    const prevOrders = prevPeriodStats?.successfulOrders || 0;

    let revenueGrowth = 0;
    if (prevRevenue > 0) {
      revenueGrowth = Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 1000) / 10;
    } else if (totalRevenue > 0) {
      revenueGrowth = 100;
    }

    // 3. Time-Series Trend for Graph
    const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const isYearlyOrLong = diffDays > 90;
    const dateFormat = isYearlyOrLong ? "%Y-%m" : "%Y-%m-%d";

    const trendsData = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          revenue: { $sum: recognizedRevenueExpr },
          orderCount: { $sum: isSuccessfulOrderExpr },
          grossAmount: { $sum: grossAmountExpr },
          productDiscounts: { $sum: productDiscountsExpr },
          couponDiscounts: { $sum: couponDiscountsExpr },
          totalDiscounts: { $sum: totalDiscountsExpr },
          shipping: { $sum: shippingExpr },
          refunds: { $sum: refundsExpr },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dateMap = new Map();
    trendsData.forEach((row) => {
      dateMap.set(row._id, {
        revenue: Math.round(row.revenue * 100) / 100,
        orderCount: row.orderCount,
        grossAmount: Math.round(row.grossAmount * 100) / 100,
        productDiscounts: Math.round(row.productDiscounts * 100) / 100,
        couponDiscounts: Math.round(row.couponDiscounts * 100) / 100,
        discounts: Math.round(row.totalDiscounts * 100) / 100,
        shipping: Math.round(row.shipping * 100) / 100,
        refunds: Math.round(row.refunds * 100) / 100,
      });
    });

    const series = [];
    if (isYearlyOrLong) {
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor <= end) {
        const year = cursor.getFullYear();
        const month = String(cursor.getMonth() + 1).padStart(2, "0");
        const key = `${year}-${month}`;
        const data = dateMap.get(key) || {
          revenue: 0,
          orderCount: 0,
          grossAmount: 0,
          productDiscounts: 0,
          couponDiscounts: 0,
          discounts: 0,
          shipping: 0,
          refunds: 0,
        };
        const label = cursor.toLocaleString("en-US", { month: "short", year: "numeric" });
        series.push({
          key,
          date: key,
          label,
          revenue: data.revenue,
          netRevenue: data.revenue,
          orderCount: data.orderCount,
          successfulOrders: data.orderCount,
          grossAmount: data.grossAmount,
          productDiscounts: data.productDiscounts,
          couponDiscounts: data.couponDiscounts,
          discounts: data.discounts,
          shipping: data.shipping,
          refunds: data.refunds,
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= end) {
        const year = cursor.getFullYear();
        const month = String(cursor.getMonth() + 1).padStart(2, "0");
        const day = String(cursor.getDate()).padStart(2, "0");
        const key = `${year}-${month}-${day}`;
        const data = dateMap.get(key) || {
          revenue: 0,
          orderCount: 0,
          grossAmount: 0,
          productDiscounts: 0,
          couponDiscounts: 0,
          discounts: 0,
          shipping: 0,
          refunds: 0,
        };
        const label = cursor.toLocaleString("en-US", { month: "short", day: "numeric" });
        series.push({
          key,
          date: key,
          label,
          revenue: data.revenue,
          netRevenue: data.revenue,
          orderCount: data.orderCount,
          successfulOrders: data.orderCount,
          grossAmount: data.grossAmount,
          productDiscounts: data.productDiscounts,
          couponDiscounts: data.couponDiscounts,
          discounts: data.discounts,
          shipping: data.shipping,
          refunds: data.refunds,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        successfulOrders,
        averageOrderValue,
        revenueGrowth,
        totalGrossAmount: Math.round((currentPeriodStats?.totalGrossAmount || 0) * 100) / 100,
        totalProductDiscounts: Math.round((currentPeriodStats?.totalProductDiscounts || 0) * 100) / 100,
        totalCouponDiscounts: Math.round((currentPeriodStats?.totalCouponDiscounts || 0) * 100) / 100,
        totalDiscounts: Math.round((currentPeriodStats?.totalDiscounts || 0) * 100) / 100,
        totalShipping: Math.round((currentPeriodStats?.totalShipping || 0) * 100) / 100,
        totalRefunds: Math.round((currentPeriodStats?.totalRefunds || 0) * 100) / 100,
        previousRevenue: prevRevenue,
        previousOrders: prevOrders,
        period,
        periodLabel,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString(),
          prevStart: prevStart.toISOString(),
          prevEnd: prevEnd.toISOString(),
        },
        interval: isYearlyOrLong ? "monthly" : "daily",
        series,
      },
    });
  } catch (error) {
    console.error("Dashboard revenue analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate dashboard revenue analytics.",
      error: error.message,
    });
  }
};

export {
  getSalesOverview,
  getSalesTrends,
  getProductPerformance,
  getCategoryPerformance,
  getPaymentMethodBreakdown,
  getCouponPerformance,
  getDetailedSalesReport,
  exportSalesReportCSV,
  exportSalesReportPDF,
  getDashboardRevenueAnalytics,
};

export default {
  getSalesOverview,
  getSalesTrends,
  getProductPerformance,
  getCategoryPerformance,
  getPaymentMethodBreakdown,
  getCouponPerformance,
  getDetailedSalesReport,
  exportSalesReportCSV,
  exportSalesReportPDF,
  getDashboardRevenueAnalytics,
};
