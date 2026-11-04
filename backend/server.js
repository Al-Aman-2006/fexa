import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";
import { verifyEmailConnection } from "./services/email.service.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await verifyEmailConnection();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Fexa backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
