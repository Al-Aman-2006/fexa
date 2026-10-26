import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import seedCategories from "../config/seedCategories.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const run = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/fexa-project";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for category initialization...");
    await seedCategories();
    console.log("Category initialization complete.");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Initialization script failed:", err);
    process.exit(1);
  }
};

run();
