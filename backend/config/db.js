import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import seedAdmin from "./seedAdmin.js";
import seedCategories from "./seedCategories.js";

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fexa-project";
    await mongoose.connect(mongoUri);
    console.log("mongoDB connected successfully");

    await seedAdmin();
    await seedCategories();
  } catch (error) {
    console.error("mongoDB connection failed", error.message);
    process.exit(1);
  }
};

export default connectDB;