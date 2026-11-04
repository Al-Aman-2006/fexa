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
import adminOrderRoutes from "./routes/adminOrder.routes.js";
import adminReturnRoutes from "./routes/adminReturn.routes.js";
import adminWalletRoutes from "./routes/adminWallet.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import returnRoutes from "./routes/return.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
      "http://localhost:3000",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Safe diagnostic request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/products", adminProductRoutes);
app.use("/api/admin/categories", adminCategoryRoutes);
app.use("/api/admin/coupons", adminCouponRoutes);
app.use("/api/admin/offers", adminOfferRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
app.use("/api/admin/returns", adminReturnRoutes);
app.use("/api/admin/wallet-refunds", adminWalletRoutes);
app.use("/api/admin/sales", adminSalesRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin/reviews", adminReviewRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/returns", returnRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Fexa API is running",
  });
});

export default app;