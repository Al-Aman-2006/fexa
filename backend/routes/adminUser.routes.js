import express from "express";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  blockUser,
  unblockUser,
} from "../controllers/adminUser.controller.js";
import adminMiddleware from "../middlewares/admin.middleware.js";

const router = express.Router();

// All admin user routes require admin authentication
router.use(adminMiddleware);

router.get("/", getUsers);
router.post("/", createUser);
router.put("/:userId", updateUser);
router.delete("/:userId", deleteUser);
router.patch("/:userId/block", blockUser);
router.patch("/:userId/unblock", unblockUser);

export default router;
