import express from "express";
import {
  adminLogin,
  checkAdminSession,
  adminLogout,
} from "../controllers/adminAuth.controller.js";
import adminMiddleware from "../middlewares/admin.middleware.js";

const router = express.Router();

router.post("/login", adminLogin);
router.get("/session", adminMiddleware, checkAdminSession);
router.post("/logout", adminLogout);

export default router;
