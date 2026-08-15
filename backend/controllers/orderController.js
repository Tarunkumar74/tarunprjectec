import asyncHandler from "express-async-handler";
import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import ApiError from "../utils/apiError.js";

const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
    : null;

const SHIPPING_FLAT_RATE = 49;
const TAX_RATE = 0.18; // GST 18% - adjust per client's actual tax requirement

// @desc Create a new order (from cart) - handles both COD and Razorpay init
// @route POST /api/orders
export const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod, couponCode } = req.body;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || cart.items.length === 0) throw new ApiError(400, "Cart is empty");

  // Re-validate stock at order time to avoid overselling
  for (const item of cart.items) {
    const product = await Product.findById(item.product);
    if (!product || product.stock < item.quantity) {
      throw new ApiError(400, `Insufficient stock for ${item.name}`);
    }
  }

  const itemsPrice = cart.items.reduce((acc, i) => acc + i.price * i.quantity, 0);

  let discountAmount = 0;
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
    if (coupon && coupon.expiresAt > new Date() && itemsPrice >= coupon.minPurchase) {
      discountAmount =
        coupon.discountType === "percentage" ? (itemsPrice * coupon.discountValue) / 100 : coupon.discountValue;
      if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      coupon.usedCount += 1;
      await coupon.save();
    }
  }

  const taxPrice = Math.round((itemsPrice - discountAmount) * TAX_RATE);
  const shippingPrice = itemsPrice > 999 ? 0 : SHIPPING_FLAT_RATE;
  const totalPrice = Math.round(itemsPrice - discountAmount + taxPrice + shippingPrice);

  const order = await Order.create({
    user: req.user._id,
    orderItems: cart.items.map((i) => ({
      product: i.product,
      name: i.name,
      image: i.image,
      price: i.price,
      variant: i.variant,
      quantity: i.quantity,
    })),
    shippingAddress,
    paymentMethod,
    itemsPrice,
    discountAmount,
    couponCode,
    taxPrice,
    shippingPrice,
    totalPrice,
    statusHistory: [{ status: "pending", note: "Order placed" }],
  });

  if (paymentMethod === "cod") {
    // Deduct stock immediately for COD orders
    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
    }
    cart.items = [];
    cart.coupon = null;
    await cart.save();
    return res.status(201).json({ success: true, order });
  }

  // Razorpay flow
  if (!razorpay) throw new ApiError(500, "Payment gateway not configured");
  const razorpayOrder = await razorpay.orders.create({
    amount: totalPrice * 100, // paise
    currency: "INR",
    receipt: order._id.toString(),
  });

  order.paymentResult = { razorpayOrderId: razorpayOrder.id, status: "created" };
  await order.save();

  res.status(201).json({
    success: true,
    order,
    razorpayOrder,
    key: process.env.RAZORPAY_KEY_ID,
  });
});

// @desc Verify Razorpay payment signature and finalize order
// @route POST /api/orders/:id/verify-payment
export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw new ApiError(400, "Payment verification failed");
  }

  order.isPaid = true;
  order.paidAt = new Date();
  order.status = "confirmed";
  order.paymentResult = {
    id: razorpay_payment_id,
    status: "paid",
    razorpayOrderId: razorpay_order_id,
    razorpaySignature: razorpay_signature,
  };
  order.statusHistory.push({ status: "confirmed", note: "Payment verified" });
  await order.save();

  for (const item of order.orderItems) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
  }
  await Cart.findOneAndUpdate({ user: order.user }, { items: [], coupon: null });

  res.json({ success: true, order });
});

// @desc Get logged-in user's orders
// @route GET /api/orders/my-orders
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort("-createdAt");
  res.json({ success: true, orders });
});

// @desc Get single order (owner or admin)
// @route GET /api/orders/:id
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email");
  if (!order) throw new ApiError(404, "Order not found");
  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    throw new ApiError(403, "Not authorized to view this order");
  }
  res.json({ success: true, order });
});

// @desc Cancel order (user, only if not shipped)
// @route PUT /api/orders/:id/cancel
export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");
  if (order.user.toString() !== req.user._id.toString()) throw new ApiError(403, "Not authorized");
  if (["shipped", "delivered", "cancelled"].includes(order.status)) {
    throw new ApiError(400, `Cannot cancel an order that is already ${order.status}`);
  }

  order.status = "cancelled";
  order.cancelReason = req.body.reason || "Cancelled by customer";
  order.statusHistory.push({ status: "cancelled", note: order.cancelReason });
  await order.save();

  for (const item of order.orderItems) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
  }

  res.json({ success: true, order });
});

// @desc Request return (user, only if delivered)
// @route PUT /api/orders/:id/return
export const requestReturn = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");
  if (order.user.toString() !== req.user._id.toString()) throw new ApiError(403, "Not authorized");
  if (order.status !== "delivered") throw new ApiError(400, "Only delivered orders can be returned");

  order.status = "returned";
  order.returnReason = req.body.reason || "Return requested";
  order.statusHistory.push({ status: "returned", note: order.returnReason });
  await order.save();

  res.json({ success: true, order });
});

// ---- Admin ----

// @desc Get all orders (admin)
// @route GET /api/orders
export const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find().populate("user", "name email").sort("-createdAt");
  res.json({ success: true, orders });
});

// @desc Update order status (admin)
// @route PUT /api/orders/:id/status
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  order.status = status;
  if (status === "delivered") order.deliveredAt = new Date();
  order.statusHistory.push({ status, note });
  await order.save();

  res.json({ success: true, order });
});
