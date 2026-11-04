import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import {
  getEligibleReturnItems,
  createReturnRequest,
  getCustomerReturns,
  getCustomerReturnById,
} from "../controllers/return.controller.js";

const router = express.Router();

// All customer return endpoints require customer authentication
router.use(authMiddleware);

// GET /api/returns/eligible-items - List items from delivered orders that are eligible for return
router.get("/eligible-items", getEligibleReturnItems);

// POST /api/returns - Submit a new return request
router.post("/", createReturnRequest);

// GET /api/returns - List customer's return requests
router.get("/", getCustomerReturns);

// GET /api/returns/:id - Get detailed status of a specific return request
router.get("/:id", getCustomerReturnById);

export default router;
