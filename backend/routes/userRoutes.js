import express from "express";
import multer from "multer";
import {
  getProfile,
  updateProfile,
  addAddress,
  deleteAddress,
  toggleWishlist,
  getWishlist,
  trackRecentlyViewed,
  getAllUsers,
  updateUser,
} from "../controllers/userController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(protect);

router.get("/me", getProfile);
router.put("/me", upload.single("avatar"), updateProfile);
router.post("/me/addresses", addAddress);
router.delete("/me/addresses/:addressId", deleteAddress);
router.get("/me/wishlist", getWishlist);
router.post("/me/wishlist/:productId", toggleWishlist);
router.post("/me/recently-viewed/:productId", trackRecentlyViewed);

// Admin
router.get("/", admin, getAllUsers);
router.put("/:id", admin, updateUser);

export default router;
