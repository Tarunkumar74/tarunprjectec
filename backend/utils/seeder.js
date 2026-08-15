// Run with: npm run seed
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";

dotenv.config();
await connectDB();

const seed = async () => {
  try {
    const adminExists = await User.findOne({ email: "admin@store.com" });
    if (!adminExists) {
      await User.create({
        name: "Admin",
        email: "admin@store.com",
        password: "Admin@123",
        role: "admin",
        isEmailVerified: true,
      });
      console.log("Admin user created: admin@store.com / Admin@123 (change this immediately)");
    }

    let category = await Category.findOne({ name: "Electronics" });
    if (!category) {
      category = await Category.create({ name: "Electronics", description: "Gadgets and devices" });
    }

    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      await Product.create([
        {
          name: "Wireless Bluetooth Headphones",
          description: "Premium over-ear headphones with active noise cancellation.",
          brand: "AudioMax",
          category: category._id,
          images: [{ url: "https://via.placeholder.com/500", public_id: "placeholder" }],
          price: 2999,
          discountPrice: 2299,
          stock: 50,
          isFeatured: true,
          isBestSeller: true,
        },
        {
          name: "Smart Fitness Watch",
          description: "Track your workouts, heart rate, and sleep.",
          brand: "FitTrack",
          category: category._id,
          images: [{ url: "https://via.placeholder.com/500", public_id: "placeholder" }],
          price: 4999,
          stock: 30,
          isFeatured: true,
        },
      ]);
      console.log("Sample products seeded");
    }

    console.log("Seeding complete");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
};

seed();
