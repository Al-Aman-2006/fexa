import express from "express";
import adminMiddleware from "../middlewares/admin.middleware.js";
import {
  getAdminReturns,
  getAdminReturnById,
  approveReturnRequest,
  rejectReturnRequest,
} from "../controllers/adminReturn.controller.js";

const router = express.Router();

// Guard all admin return endpoints with admin authorization
router.use(adminMiddleware);

// GET /api/admin/returns - List return requests with search, filters, pagination, and aggregated stats
router.get("/", getAdminReturns);

// GET /api/admin/returns/:id - Inspect detailed return request and order snapshot
router.get("/:id", getAdminReturnById);

// POST /api/admin/returns/:id/approve - Approve return request, disburse refund to customer wallet, restock inventory
router.post("/:id/approve", approveReturnRequest);

// POST /api/admin/returns/:id/reject - Reject return request with mandatory explanation
router.post("/:id/reject", rejectReturnRequest);

export default router;
