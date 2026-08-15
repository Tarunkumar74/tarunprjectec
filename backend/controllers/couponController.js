import asyncHandler from "express-async-handler";
import Coupon from "../models/Coupon.js";
import ApiError from "../utils/apiError.js";

// @desc Validate + apply a coupon to get discount preview
// @route POST /api/coupons/apply
export const applyCoupon = asyncHandler(async (req, res) => {
  const { code, cartTotal } = req.body;
  const coupon = await Coupon.findOne({ code: code?.toUpperCase(), isActive: true });

  if (!coupon) throw new ApiError(404, "Invalid coupon code");
  if (coupon.expiresAt < new Date()) throw new ApiError(400, "Coupon has expired");
  if (coupon.usedCount >= coupon.usageLimit) throw new ApiError(400, "Coupon usage limit reached");
  if (cartTotal < coupon.minPurchase) {
    throw new ApiError(400, `Minimum purchase of ₹${coupon.minPurchase} required`);
  }

  let discount =
    coupon.discountType === "percentage" ? (cartTotal * coupon.discountValue) / 100 : coupon.discountValue;
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);

  res.json({ success: true, coupon: { code: coupon.code, discount: Math.round(discount) } });
});

// Admin CRUD
export const getCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find().sort("-createdAt");
  res.json({ success: true, coupons });
});

export const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create(req.body);
  res.status(201).json({ success: true, coupon });
});

export const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!coupon) throw new ApiError(404, "Coupon not found");
  res.json({ success: true, coupon });
});

export const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new ApiError(404, "Coupon not found");
  res.json({ success: true, message: "Coupon deleted" });
});
