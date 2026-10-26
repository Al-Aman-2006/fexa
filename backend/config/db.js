import mongoose from "mongoose";
import seedAdmin from "./seedAdmin.js";
import seedCategories from "./seedCategories.js";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("mongoDB connected successfully");

    await seedAdmin();
    await seedCategories();
  } catch (error) {
    console.error("mongoDB connection failed", error.message);
    process.exit(1);
  }
};

export default connectDB;