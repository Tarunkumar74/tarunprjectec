import asyncHandler from "express-async-handler";
import Category from "../models/Category.js";
import ApiError from "../utils/apiError.js";

export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).populate("parent", "name slug");
  res.json({ success: true, categories });
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);
  res.status(201).json({ success: true, category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!category) throw new ApiError(404, "Category not found");
  res.json({ success: true, category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!category) throw new ApiError(404, "Category not found");
  res.json({ success: true, message: "Category removed" });
});
