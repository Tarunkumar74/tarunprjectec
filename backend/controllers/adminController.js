import asyncHandler from "express-async-handler";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

// @desc Dashboard summary cards
// @route GET /api/admin/dashboard
export const getDashboardStats = asyncHandler(async (req, res) => {
  const [totalOrders, totalUsers, totalProducts, revenueAgg, pendingOrders] = await Promise.all([
    Order.countDocuments(),
    User.countDocuments({ role: "user" }),
    Product.countDocuments({ isActive: true }),
    Order.aggregate([{ $match: { isPaid: true } }, { $group: { _id: null, total: { $sum: "$totalPrice" } } }]),
    Order.countDocuments({ status: "pending" }),
  ]);

  res.json({
    success: true,
    stats: {
      totalOrders,
      totalUsers,
      totalProducts,
      totalRevenue: revenueAgg[0]?.total || 0,
      pendingOrders,
    },
  });
});

// @desc Revenue by day for last N days (for charts)
// @route GET /api/admin/dashboard/revenue?days=30
export const getRevenueChart = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const data = await Order.aggregate([
    { $match: { isPaid: true, createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        revenue: { $sum: "$totalPrice" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({ success: true, data });
});

// @desc Top-selling products
// @route GET /api/admin/dashboard/top-products
export const getTopProducts = asyncHandler(async (req, res) => {
  const data = await Order.aggregate([
    { $match: { isPaid: true } },
    { $unwind: "$orderItems" },
    {
      $group: {
        _id: "$orderItems.product",
        name: { $first: "$orderItems.name" },
        totalSold: { $sum: "$orderItems.quantity" },
        revenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
  ]);

  res.json({ success: true, data });
});

// @desc Low stock alert list
// @route GET /api/admin/dashboard/low-stock
export const getLowStock = asyncHandler(async (req, res) => {
  const threshold = parseInt(req.query.threshold, 10) || 10;
  const products = await Product.find({ isActive: true, stock: { $lte: threshold } }).select("name stock");
  res.json({ success: true, products });
});
