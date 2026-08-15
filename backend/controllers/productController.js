import asyncHandler from "express-async-handler";
import Product from "../models/Product.js";
import ApiError from "../utils/apiError.js";
import ApiFeatures from "../utils/apiFeatures.js";

// @desc Get all products (search, filter, sort, pagination)
// @route GET /api/products
export const getProducts = asyncHandler(async (req, res) => {
  const total = await Product.countDocuments({ isActive: true });

  const features = new ApiFeatures(Product.find({ isActive: true }), req.query)
    .search()
    .filter()
    .sort()
    .paginate();

  const products = await features.query.populate("category", "name slug");

  res.json({
    success: true,
    count: products.length,
    total,
    page: features.pagination.page,
    pages: Math.ceil(total / features.pagination.limit),
    products,
  });
});

// @desc Get single product by slug
// @route GET /api/products/:slug
export const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true })
    .populate("category", "name slug")
    .populate("relatedProducts", "name slug price images rating");

  if (!product) throw new ApiError(404, "Product not found");
  res.json({ success: true, product });
});

// @desc Create product (admin)
// @route POST /api/products
export const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json({ success: true, product });
});

// @desc Update product (admin)
// @route PUT /api/products/:id
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!product) throw new ApiError(404, "Product not found");
  res.json({ success: true, product });
});

// @desc Delete product (admin) - soft delete
// @route DELETE /api/products/:id
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!product) throw new ApiError(404, "Product not found");
  res.json({ success: true, message: "Product removed" });
});

// @desc Add review
// @route POST /api/products/:id/reviews
export const addReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, "Product not found");

  const alreadyReviewed = product.reviews.find((r) => r.user.toString() === req.user._id.toString());
  if (alreadyReviewed) throw new ApiError(400, "You have already reviewed this product");

  product.reviews.push({ user: req.user._id, name: req.user.name, rating: Number(rating), comment });
  product.numReviews = product.reviews.length;
  product.rating = product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length;
  await product.save();

  res.status(201).json({ success: true, message: "Review added" });
});

// @desc Get featured / best-seller / flash-sale product groups for homepage
// @route GET /api/products/highlights
export const getHighlights = asyncHandler(async (req, res) => {
  const [featured, bestSellers, flashSale] = await Promise.all([
    Product.find({ isActive: true, isFeatured: true }).limit(8),
    Product.find({ isActive: true, isBestSeller: true }).limit(8),
    Product.find({ isActive: true, isFlashSale: true, flashSaleEndsAt: { $gt: new Date() } }).limit(8),
  ]);
  res.json({ success: true, featured, bestSellers, flashSale });
});
