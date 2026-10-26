import mongoose from "mongoose";
import Order from "../models/order.model.js";

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
    case "prevMonth": {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      periodLabel = "Previous Month";
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

// =========================================================================
// 1. GET SALES OVERVIEW
// Calculates all top-level KPI cards and previous-period growth
// =========================================================================
const getSalesOverview = async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const { start, end, prevStart, prevEnd, periodLabel } = parseDateRange(period, startDate, endDate);

    // Current period aggregation across all orders in range
    const [currentStats] = await Order.aggregate([
      { $match: getBaseSalesFilter(start, end) },
      {
        $group: {
          _id: null,
          totalAllOrders: { $sum: 1 },

          // Recognized / Paid Revenue (Verified Paid Online or Delivered COD)
          recognizedRevenue: {
            $sum: {
              $cond: [
                {
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
                },
                "$totalAmount",
                0,
              ],
            },
          },

          // Gross Order Value of all eligible orders (excludes Failed & Cancelled)
          grossOrderValue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$paymentStatus", "Failed"] },
                    { $ne: ["$orderStatus", "Cancelled"] },
                  ],
                },
                "$totalAmount",
                0,
              ],
            },
          },

          // Eligible Orders Count
          eligibleOrdersCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$paymentStatus", "Failed"] },
                    { $ne: ["$orderStatus", "Cancelled"] },
                  ],
                },
                1,
                0,
              ],
            },
          },

          // Paid Orders Count
          paidOrdersCount: {
            $sum: {
              $cond: [
                {
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
                },
                1,
                0,
              ],
            },
          },

          // Successful Payments (paymentStatus === 'Paid')
          successfulPaymentsAmount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$totalAmount", 0],
            },
          },
          successfulPaymentsCount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Paid"] }, 1, 0],
            },
          },

          // Pending Payments (Razorpay Pending online or COD in-transit)
          pendingPaymentsAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$orderStatus", "Cancelled"] },
                    {
                      $or: [
                        {
                          $and: [
                            { $eq: ["$paymentMethod", "Razorpay"] },
                            { $eq: ["$paymentStatus", "Pending"] },
                          ],
                        },
                        {
                          $and: [
                            { $eq: ["$paymentMethod", "COD"] },
                            { $eq: ["$paymentStatus", "Pending"] },
                            { $ne: ["$orderStatus", "Delivered"] },
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
                    {
                      $or: [
                        {
                          $and: [
                            { $eq: ["$paymentMethod", "Razorpay"] },
                            { $eq: ["$paymentStatus", "Pending"] },
                          ],
                        },
                        {
                          $and: [
                            { $eq: ["$paymentMethod", "COD"] },
                            { $eq: ["$paymentStatus", "Pending"] },
                            { $ne: ["$orderStatus", "Delivered"] },
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

          // Coupon Discounts on Eligible Orders
          totalDiscountsAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$paymentStatus", "Failed"] },
                    { $ne: ["$orderStatus", "Cancelled"] },
                  ],
                },
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
                    { $ne: ["$paymentStatus", "Failed"] },
                    { $ne: ["$orderStatus", "Cancelled"] },
                    { $gt: [{ $ifNull: ["$discountAmount", 0] }, 0] },
                  ],
                },
                1,
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
          recognizedRevenue: {
            $sum: {
              $cond: [
                {
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
                },
                "$totalAmount",
                0,
              ],
            },
          },
          eligibleOrdersCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$paymentStatus", "Failed"] },
                    { $ne: ["$orderStatus", "Cancelled"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const stats = currentStats || {
      totalAllOrders: 0,
      recognizedRevenue: 0,
      grossOrderValue: 0,
      eligibleOrdersCount: 0,
      paidOrdersCount: 0,
      successfulPaymentsAmount: 0,
      successfulPaymentsCount: 0,
      pendingPaymentsAmount: 0,
      pendingPaymentsCount: 0,
      cancelledOrdersAmount: 0,
      cancelledOrdersCount: 0,
      failedPaymentsAmount: 0,
      failedPaymentsCount: 0,
      totalDiscountsAmount: 0,
      couponRedemptionsCount: 0,
    };

    const unitsSold = unitsResult?.totalUnitsSold || 0;

    // Average Order Value calculation:
    // If we have verified paid orders, AOV is recognized revenue / paid orders count.
    // If not, calculate from gross order value / eligible orders count.
    let aov = 0;
    if (stats.paidOrdersCount > 0) {
      aov = Math.round(stats.recognizedRevenue / stats.paidOrdersCount);
    } else if (stats.eligibleOrdersCount > 0) {
      aov = Math.round(stats.grossOrderValue / stats.eligibleOrdersCount);
    }

    // Comparison growth percentage:
    // Only calculate when previous period contains actual data
    let revenueGrowth = null;
    let ordersGrowth = null;

    if (prevStats && prevStats.recognizedRevenue > 0) {
      revenueGrowth = Number(
        (((stats.recognizedRevenue - prevStats.recognizedRevenue) / prevStats.recognizedRevenue) * 100).toFixed(1)
      );
    } else if (prevStats && prevStats.recognizedRevenue === 0 && stats.recognizedRevenue > 0) {
      revenueGrowth = 100;
    }

    if (prevStats && prevStats.eligibleOrdersCount > 0) {
      ordersGrowth = Number(
        (((stats.eligibleOrdersCount - prevStats.eligibleOrdersCount) / prevStats.eligibleOrdersCount) * 100).toFixed(1)
      );
    } else if (prevStats && prevStats.eligibleOrdersCount === 0 && stats.eligibleOrdersCount > 0) {
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
          recognizedRevenue: stats.recognizedRevenue,
          grossOrderValue: stats.grossOrderValue,
          netSales: Math.max(0, stats.recognizedRevenue - stats.totalDiscountsAmount),
          totalOrders: stats.eligibleOrdersCount,
          totalAllOrders: stats.totalAllOrders,
          paidOrdersCount: stats.paidOrdersCount,
          unitsSold,
          averageOrderValue: aov,
          successfulPayments: {
            amount: stats.successfulPaymentsAmount,
            count: stats.successfulPaymentsCount,
          },
          pendingPayments: {
            amount: stats.pendingPaymentsAmount,
            count: stats.pendingPaymentsCount,
          },
          cancelledOrders: {
            amount: stats.cancelledOrdersAmount,
            count: stats.cancelledOrdersCount,
          },
          failedPayments: {
            amount: stats.failedPaymentsAmount,
            count: stats.failedPaymentsCount,
          },
          coupons: {
            totalDiscountAmount: stats.totalDiscountsAmount,
            redemptionsCount: stats.couponRedemptionsCount,
          },
          growth: {
            revenueGrowth,
            ordersGrowth,
            previousRevenue: prevStats?.recognizedRevenue || 0,
            previousOrders: prevStats?.eligibleOrdersCount || 0,
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

    const trendsData = await Order.aggregate([
      { $match: getEligibleOrdersMatch(start, end) },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          orderCount: { $sum: 1 },
          recognizedRevenue: {
            $sum: {
              $cond: [
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
                "$totalAmount",
                0,
              ],
            },
          },
          grossValue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Build contiguous date map
    const map = new Map();
    trendsData.forEach((row) => {
      map.set(row._id, {
        revenue: row.recognizedRevenue,
        orderCount: row.orderCount,
        grossValue: row.grossValue,
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
        const data = map.get(key) || { revenue: 0, orderCount: 0, grossValue: 0 };
        const label = cursor.toLocaleString("en-US", { month: "short", year: "numeric" });

        series.push({
          key,
          label,
          revenue: data.revenue,
          orderCount: data.orderCount,
          grossValue: data.grossValue,
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
        const data = map.get(key) || { revenue: 0, orderCount: 0, grossValue: 0 };
        const label = cursor.toLocaleString("en-US", { month: "short", day: "numeric" });

        series.push({
          key,
          label,
          revenue: data.revenue,
          orderCount: data.orderCount,
          grossValue: data.grossValue,
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
          grossSales: 1,
          netSales: "$grossSales", // lineTotal is snapshot price paid
          ordersCount: { $size: "$ordersCount" },
          averageUnitPrice: { $avg: "$unitPrices" },
        },
      },
      { $sort: { [sortField]: sortDir } },
    ];

    const allVariants = await Order.aggregate(pipeline);
    const totalVariants = allVariants.length;
    const paginatedVariants = allVariants.slice(skip, skip + limitNum);

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
// Men, Women, Unisex breakdown without double-counting
// =========================================================================
const getCategoryPerformance = async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const { start, end } = parseDateRange(period, startDate, endDate);

    const categoriesData = await Order.aggregate([
      { $match: getEligibleOrdersMatch(start, end) },
      { $unwind: "$items" },
      {
        $group: {
          _id: { $ifNull: ["$items.category", "Unisex"] },
          unitsSold: { $sum: "$items.quantity" },
          grossSales: { $sum: "$items.lineTotal" },
          orderIds: { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          category: "$_id",
          unitsSold: 1,
          grossSales: 1,
          ordersCount: { $size: "$orderIds" },
          _id: 0,
        },
      },
      { $sort: { grossSales: -1 } },
    ]);

    // Ensure all standard categories (Men, Women, Unisex) exist in response
    const standardCategories = ["Men", "Women", "Unisex"];
    const resultMap = new Map(categoriesData.map((c) => [c.category, c]));

    let totalGross = 0;
    const categories = standardCategories.map((cat) => {
      const existing = resultMap.get(cat) || {
        category: cat,
        unitsSold: 0,
        grossSales: 0,
        ordersCount: 0,
      };
      totalGross += existing.grossSales;
      return existing;
    });

    // Add any non-standard categories that exist in data
    categoriesData.forEach((c) => {
      if (!standardCategories.includes(c.category)) {
        categories.push(c);
        totalGross += c.grossSales;
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
        totalGrossSales: totalGross,
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
// Razorpay paid vs COD delivered vs COD pending vs Failed
// =========================================================================
const getPaymentMethodBreakdown = async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const { start, end } = parseDateRange(period, startDate, endDate);

    const paymentStats = await Order.aggregate([
      { $match: getBaseSalesFilter(start, end) },
      {
        $group: {
          _id: {
            paymentMethod: "$paymentMethod",
            paymentStatus: "$paymentStatus",
            orderStatus: "$orderStatus",
          },
          count: { $sum: 1 },
          amount: { $sum: "$totalAmount" },
        },
      },
    ]);

    let razorpayPaid = { count: 0, amount: 0 };
    let razorpayPending = { count: 0, amount: 0 };
    let razorpayFailed = { count: 0, amount: 0 };

    let codDelivered = { count: 0, amount: 0 };
    let codInTransit = { count: 0, amount: 0 };
    let codCancelled = { count: 0, amount: 0 };

    let cancelledOrders = { count: 0, amount: 0 };

    paymentStats.forEach((group) => {
      const { paymentMethod, paymentStatus, orderStatus } = group._id;
      const count = group.count;
      const amount = group.amount;

      if (orderStatus === "Cancelled") {
        cancelledOrders.count += count;
        cancelledOrders.amount += amount;
        return;
      }

      if (paymentMethod === "Razorpay") {
        if (paymentStatus === "Paid") {
          razorpayPaid.count += count;
          razorpayPaid.amount += amount;
        } else if (paymentStatus === "Failed") {
          razorpayFailed.count += count;
          razorpayFailed.amount += amount;
        } else {
          razorpayPending.count += count;
          razorpayPending.amount += amount;
        }
      } else if (paymentMethod === "COD") {
        if (orderStatus === "Delivered" || paymentStatus === "Paid") {
          codDelivered.count += count;
          codDelivered.amount += amount;
        } else {
          codInTransit.count += count;
          codInTransit.amount += amount;
        }
      } else {
        // Any other payment method (Card/UPI direct)
        if (paymentStatus === "Paid") {
          razorpayPaid.count += count;
          razorpayPaid.amount += amount;
        } else if (paymentStatus === "Failed") {
          razorpayFailed.count += count;
          razorpayFailed.amount += amount;
        } else {
          razorpayPending.count += count;
          razorpayPending.amount += amount;
        }
      }
    });

    const totalCollected = razorpayPaid.amount + codDelivered.amount;

    return res.status(200).json({
      success: true,
      data: {
        totalCollected,
        methods: {
          razorpayPaid,
          razorpayPending,
          razorpayFailed,
          codDelivered,
          codInTransit,
          cancelledOrders,
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
        itemsSummary,
        sizesSummary,
        totalUnits,
        subtotal: o.subtotal,
        couponCode: o.couponCode || null,
        discountPercentage: o.discountPercentage || 0,
        discountAmount: o.discountAmount || 0,
        shippingCost: o.shippingCost || 0,
        totalAmount: o.totalAmount,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        orderStatus: o.orderStatus,
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
      "Product Summary",
      "Perfume Sizes",
      "Total Units",
      "Merchandise Subtotal (INR)",
      "Coupon Code",
      "Coupon Discount (INR)",
      "Shipping Cost (INR)",
      "Final Order Amount (INR)",
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

      const row = [
        o.orderNumber,
        new Date(o.createdAt).toISOString().replace("T", " ").substring(0, 19),
        customerName,
        o.user?.email || "N/A",
        itemsSummary,
        sizesSummary,
        totalUnits,
        o.subtotal || 0,
        o.couponCode || "None",
        o.discountAmount || 0,
        o.shippingCost || 0,
        o.totalAmount || 0,
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

export {
  getSalesOverview,
  getSalesTrends,
  getProductPerformance,
  getCategoryPerformance,
  getPaymentMethodBreakdown,
  getCouponPerformance,
  getDetailedSalesReport,
  exportSalesReportCSV,
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
};
