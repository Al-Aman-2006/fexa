import express from "express";
import adminMiddleware from "../middlewares/admin.middleware.js";
import {
  createCoupon,
  getAdminCoupons,
  getCouponById,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
} from "../controllers/coupon.controller.js";

const router = express.Router();

// All admin coupon routes require admin authorization
router.use(adminMiddleware);

router.get("/", getAdminCoupons);
router.post("/", createCoupon);
router.get("/:id", getCouponById);
router.put("/:id", updateCoupon);
router.patch("/:id/status", toggleCouponStatus);
router.delete("/:id", deleteCoupon);

export default router;
