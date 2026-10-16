const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const path = require("path");

const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profile.routes");
const adminAuthRoutes = require("./routes/adminAuth.routes");
const adminUserRoutes = require("./routes/adminUser.routes");
const adminProductRoutes = require("./routes/adminProduct.routes");
const productRoutes = require("./routes/product.routes");
const cartRoutes = require("./routes/cart.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const orderRoutes = require("./routes/order.routes");
const contactRoutes = require("./routes/contact.routes");
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

app.use("/api/products", productRoutes);

app.use("/api/cart", cartRoutes);

app.use("/api/wishlist", wishlistRoutes);

app.use("/api/orders", orderRoutes);

app.use("/api/contact", contactRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Fexa API is running",
  });
});

module.exports = app;