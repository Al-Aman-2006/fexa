import express from "express";
import {
  submitContactMessage,
  getContactReasons,
} from "../controllers/contact.controller.js";

const router = express.Router();

// GET /api/contact/reasons - Return allowed contact reasons
router.get("/reasons", getContactReasons);

// POST /api/contact - Submit customer inquiry
router.post("/", submitContactMessage);

export default router;
