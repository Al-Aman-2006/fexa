import express from "express";
import adminMiddleware from "../middlewares/admin.middleware.js";
import {
  getSalesOverview,
  getSalesTrends,
  getProductPerformance,
  getCategoryPerformance,
  getPaymentMethodBreakdown,
  getCouponPerformance,
  getDetailedSalesReport,
  exportSalesReportCSV,
} from "../controllers/sales.controller.js";

const router = express.Router();

// All admin sales routes require valid admin authentication & authorization
router.use(adminMiddleware);

// Analytics & KPI endpoints
router.get("/overview", getSalesOverview);
router.get("/trends", getSalesTrends);
router.get("/products", getProductPerformance);
router.get("/categories", getCategoryPerformance);
router.get("/payments", getPaymentMethodBreakdown);
router.get("/coupons", getCouponPerformance);
router.get("/report", getDetailedSalesReport);
router.get("/export", exportSalesReportCSV);

export default router;
