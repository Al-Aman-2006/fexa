import express from "express";
import adminMiddleware from "../middlewares/admin.middleware.js";
import {
  getAdminOffers,
  getOfferById,
  createOffer,
  updateOffer,
  toggleOfferStatus,
  deleteOffer,
  searchAdminOfferProducts,
} from "../controllers/adminOffer.controller.js";

const router = express.Router();

// All offer management endpoints require Admin authorization
router.use(adminMiddleware);

router.get("/", getAdminOffers);
router.get("/search-products", searchAdminOfferProducts);
router.get("/:id", getOfferById);
router.post("/", createOffer);
router.put("/:id", updateOffer);
router.patch("/:id/status", toggleOfferStatus);
router.delete("/:id", deleteOffer);

export default router;
