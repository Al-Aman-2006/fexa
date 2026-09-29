const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profile.routes");
const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/uploads",express.static("uploads"));


app.use("/api/auth", authRoutes);

app.use("/api/profile", profileRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Fexa API is running",
  });
});

module.exports = app;