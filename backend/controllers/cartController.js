import asyncHandler from "express-async-handler";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import ApiError from "../utils/apiError.js";

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

// @desc Get current user's cart
// @route GET /api/cart
export const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  res.json({ success: true, cart });
});

// @desc Add item to cart
// @route POST /api/cart
export const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, variant } = req.body;
  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw new ApiError(404, "Product not found");
  if (product.stock < quantity) throw new ApiError(400, "Insufficient stock");

  const cart = await getOrCreateCart(req.user._id);
  const existingItem = cart.items.find(
    (i) => i.product.toString() === productId && i.variant?.color === variant?.color && i.variant?.size === variant?.size
  );

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({
      product: product._id,
      name: product.name,
      image: product.images?.[0]?.url || "",
      price: product.discountPrice || product.price,
      variant,
      quantity,
    });
  }

  await cart.save();
  res.json({ success: true, cart });
});

// @desc Update cart item quantity
// @route PUT /api/cart/:itemId
export const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw new ApiError(404, "Cart item not found");

  if (quantity <= 0) {
    item.deleteOne();
  } else {
    item.quantity = quantity;
  }
  await cart.save();
  res.json({ success: true, cart });
});

// @desc Remove item from cart
// @route DELETE /api/cart/:itemId
export const removeCartItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = cart.items.filter((i) => i._id.toString() !== req.params.itemId);
  await cart.save();
  res.json({ success: true, cart });
});

// @desc Clear cart
// @route DELETE /api/cart
export const clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = [];
  cart.coupon = null;
  await cart.save();
  res.json({ success: true, cart });
});
