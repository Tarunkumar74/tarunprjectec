import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import Product from "../models/Product.js";
import ApiError from "../utils/apiError.js";
import cloudinary from "../config/cloudinary.js";

// @desc Get logged-in user's profile
// @route GET /api/users/me
export const getProfile = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

// @desc Update profile (name, avatar)
// @route PUT /api/users/me
export const updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const user = await User.findById(req.user._id);
  if (name) user.name = name;

  if (req.file) {
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: "avatars" }, (err, result) =>
        err ? reject(err) : resolve(result)
      );
      stream.end(req.file.buffer);
    });
    user.avatar = uploadResult.secure_url;
  }

  await user.save();
  res.json({ success: true, user });
});

// @desc Add / update address
// @route POST /api/users/me/addresses
export const addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (req.body.isDefault) {
    user.addresses.forEach((a) => (a.isDefault = false));
  }
  user.addresses.push(req.body);
  await user.save();
  res.status(201).json({ success: true, addresses: user.addresses });
});

// @desc Delete address
// @route DELETE /api/users/me/addresses/:addressId
export const deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.addresses = user.addresses.filter((a) => a._id.toString() !== req.params.addressId);
  await user.save();
  res.json({ success: true, addresses: user.addresses });
});

// @desc Toggle wishlist item
// @route POST /api/users/me/wishlist/:productId
export const toggleWishlist = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId);
  if (!product) throw new ApiError(404, "Product not found");

  const user = await User.findById(req.user._id);
  const idx = user.wishlist.findIndex((id) => id.toString() === req.params.productId);
  if (idx > -1) {
    user.wishlist.splice(idx, 1);
  } else {
    user.wishlist.push(product._id);
  }
  await user.save();
  res.json({ success: true, wishlist: user.wishlist });
});

// @desc Get wishlist (populated)
// @route GET /api/users/me/wishlist
export const getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate("wishlist");
  res.json({ success: true, wishlist: user.wishlist });
});

// @desc Track recently viewed product
// @route POST /api/users/me/recently-viewed/:productId
export const trackRecentlyViewed = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.recentlyViewed = user.recentlyViewed.filter((id) => id.toString() !== req.params.productId);
  user.recentlyViewed.unshift(req.params.productId);
  user.recentlyViewed = user.recentlyViewed.slice(0, 10);
  await user.save();
  res.json({ success: true });
});

// ---- Admin ----

// @desc Get all users (admin)
// @route GET /api/users
export const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select("-refreshTokens");
  res.json({ success: true, users });
});

// @desc Update user role / active status (admin)
// @route PUT /api/users/:id
export const updateUser = asyncHandler(async (req, res) => {
  const { role, isActive } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");
  if (role) user.role = role;
  if (typeof isActive === "boolean") user.isActive = isActive;
  await user.save();
  res.json({ success: true, user });
});
