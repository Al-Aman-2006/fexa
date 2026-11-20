import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

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

// Enable reverse proxy support for Render and cloud load balancers (required for secure cookies and accurate client IP)
app.set("trust proxy", 1);

// Build explicit allowed origins whitelist from environment and local dev defaults
const configuredClientUrls = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
]
  .filter(Boolean)
  .flatMap((url) => url.split(",").map((s) => s.trim().replace(/\/$/, "")));

const localDevOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

const allowedOrigins = Array.from(new Set([...configuredClientUrls, ...localDevOrigins]));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server webhooks)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      // In development, permit any localhost / 127.0.0.1 port
      if (process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS policy rejection: Origin ${origin} is not allowed.`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "x-category-context",
      "x-razorpay-signature",
    ],
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

// Health & readiness check endpoint for Render deployment and uptime monitors
app.get("/api/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const isDbReady = dbStatus === 1;

  const statusCode = isDbReady ? 200 : 503;
  res.status(statusCode).json({
    success: isDbReady,
    status: isDbReady ? "healthy" : "degraded",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      server: "up",
      database: isDbReady ? "connected" : "disconnected",
    },
  });
});

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Fexa API is running",
  });
});

export default app;