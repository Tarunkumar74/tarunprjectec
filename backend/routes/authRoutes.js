import express from "express";
import { body } from "express-validator";
import {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";

const router = express.Router();

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  validate,
  registerUser
);

router.post(
  "/login",
  [body("email").isEmail(), body("password").notEmpty()],
  validate,
  loginUser
);

router.post("/refresh", refreshToken);
router.post("/logout", protect, logoutUser);
router.get("/verify-email/:token", verifyEmail);
router.post("/forgot-password", [body("email").isEmail()], validate, forgotPassword);
router.put(
  "/reset-password/:token",
  [body("password").isLength({ min: 6 })],
  validate,
  resetPassword
);

export default router;
