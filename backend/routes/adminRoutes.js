import express from "express";
import {
  getDashboardStats,
  getRevenueChart,
  getTopProducts,
  getLowStock,
} from "../controllers/adminController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, admin);
router.get("/dashboard", getDashboardStats);
router.get("/dashboard/revenue", getRevenueChart);
router.get("/dashboard/top-products", getTopProducts);
router.get("/dashboard/low-stock", getLowStock);

export default router;
