import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import adminAuthRoutes from "./routes/adminAuth.routes.js";
import adminUserRoutes from "./routes/adminUser.routes.js";
import adminProductRoutes from "./routes/adminProduct.routes.js";
import adminCategoryRoutes from "./routes/adminCategory.routes.js";
import adminCouponRoutes from "./routes/adminCoupon.routes.js";
import adminSalesRoutes from "./routes/adminSales.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import orderRoutes from "./routes/order.routes.js";
import couponRoutes from "./routes/coupon.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import adminReviewRoutes from "./routes/adminReview.routes.js";
import adminOfferRoutes from "./routes/adminOffer.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/products", adminProductRoutes);
app.use("/api/admin/categories", adminCategoryRoutes);
app.use("/api/admin/coupons", adminCouponRoutes);
app.use("/api/admin/offers", adminOfferRoutes);
app.use("/api/admin/sales", adminSalesRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin/reviews", adminReviewRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Fexa API is running",
  });
});

export default app;