import crypto from "crypto";
import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import ApiError from "../utils/apiError.js";
import { generateAccessToken, generateRefreshToken, setTokenCookies } from "../utils/generateTokens.js";
import sendEmail from "../utils/sendEmail.js";

// @desc Register new user
// @route POST /api/auth/register
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) throw new ApiError(400, "User with this email already exists");

  const user = await User.create({ name, email, password });

  const verificationToken = crypto.randomBytes(32).toString("hex");
  user.emailVerificationToken = crypto.createHash("sha256").update(verificationToken).digest("hex");
  user.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
  try {
    await sendEmail({
      to: user.email,
      subject: "Verify your email",
      html: `<p>Hi ${user.name}, click <a href="${verifyUrl}">here</a> to verify your email. Link expires in 24 hours.</p>`,
    });
  } catch (err) {
    console.error("Email send failed:", err.message);
    // Don't block registration if email fails - user can request resend
  }

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  user.refreshTokens.push({ token: refreshToken });
  await user.save({ validateBeforeSave: false });
  setTokenCookies(res, accessToken, refreshToken);

  res.status(201).json({
    success: true,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    accessToken,
  });
});

// @desc Login user
// @route POST /api/auth/login
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.matchPassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }
  if (!user.isActive) throw new ApiError(403, "Account has been deactivated");

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  user.refreshTokens.push({ token: refreshToken });
  await user.save({ validateBeforeSave: false });
  setTokenCookies(res, accessToken, refreshToken);

  res.json({
    success: true,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    accessToken,
  });
});

// @desc Refresh access token
// @route POST /api/auth/refresh
export const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  if (!token) throw new ApiError(401, "Refresh token missing");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(decoded.id);
  const tokenExists = user?.refreshTokens.some((t) => t.token === token);
  if (!user || !tokenExists) throw new ApiError(401, "Refresh token not recognized");

  const newAccessToken = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  user.refreshTokens = user.refreshTokens.filter((t) => t.token !== token);
  user.refreshTokens.push({ token: newRefreshToken });
  await user.save({ validateBeforeSave: false });

  setTokenCookies(res, newAccessToken, newRefreshToken);
  res.json({ success: true, accessToken: newAccessToken });
});

// @desc Logout
// @route POST /api/auth/logout
export const logoutUser = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token && req.user) {
    req.user.refreshTokens = req.user.refreshTokens.filter((t) => t.token !== token);
    await req.user.save({ validateBeforeSave: false });
  }
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ success: true, message: "Logged out" });
});

// @desc Verify email
// @route GET /api/auth/verify-email/:token
export const verifyEmail = asyncHandler(async (req, res) => {
  const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpire: { $gt: Date.now() },
  });
  if (!user) throw new ApiError(400, "Invalid or expired verification link");

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpire = undefined;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: "Email verified successfully" });
});

// @desc Forgot password - sends reset link
// @route POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  // Respond generically either way to avoid leaking which emails are registered
  if (!user) {
    return res.json({ success: true, message: "If that email exists, a reset link has been sent" });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  user.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
  await sendEmail({
    to: user.email,
    subject: "Password reset request",
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 30 minutes. If you didn't request this, ignore this email.</p>`,
  });

  res.json({ success: true, message: "If that email exists, a reset link has been sent" });
});

// @desc Reset password
// @route PUT /api/auth/reset-password/:token
export const resetPassword = asyncHandler(async (req, res) => {
  const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });
  if (!user) throw new ApiError(400, "Invalid or expired reset link");

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.refreshTokens = []; // force re-login everywhere
  await user.save();

  res.json({ success: true, message: "Password reset successful. Please log in." });
});
