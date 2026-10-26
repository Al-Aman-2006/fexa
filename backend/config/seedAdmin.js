import bcrypt from "bcryptjs";
import User from "../models/user.model.js";

const seedAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: "admin" });

    if (!adminExists) {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      await User.create({
        name: "Fexa Admin",
        email: adminEmail.toLowerCase(),
        password: hashedPassword,
        role: "admin",
        authProvider: "local",
        emailVerified: true,
        isBlocked: false,
      });

      console.log(`✅ Default admin account created: ${adminEmail}`);
    }
  } catch (error) {
    console.error("❌ Admin seed error:", error.message);
  }
};

export default seedAdmin;
