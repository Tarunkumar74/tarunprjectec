# E-Commerce Backend (MVP) — Node/Express/MongoDB

Production-ready REST API for the e-commerce platform. This is **Phase 1 (MVP)** of the full project — see "Phase 2 Roadmap" at the bottom for deferred features.

## Architecture

```
backend/
  config/       - DB & Cloudinary config
  models/       - Mongoose schemas (User, Product, Category, Cart, Order, Coupon)
  controllers/  - Business logic
  routes/       - Express route definitions
  middleware/   - Auth guard, error handler, validation
  utils/        - Helpers (tokens, email, API features, seeder)
  server.js     - App entry point
```

## Setup

1. `cd backend && npm install`
2. Copy `.env.example` to `.env` and fill in real values:
   - `MONGO_URI` — create a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas), whitelist your IP (or `0.0.0.0/0` for dev), get the connection string.
   - `JWT_SECRET` / `JWT_REFRESH_SECRET` — generate with `openssl rand -hex 32`.
   - `SMTP_*` — for Gmail, enable 2FA then create an "App Password" (not your normal password).
   - `CLOUDINARY_*` — free tier at [cloudinary.com](https://cloudinary.com), copy from dashboard.
   - `RAZORPAY_*` — get test keys from [Razorpay Dashboard](https://dashboard.razorpay.com) → Settings → API Keys.
3. `npm run seed` — creates an admin user (`admin@store.com` / `Admin@123` — **change this password immediately after first login**) and two sample products.
4. `npm run dev` — starts on `http://localhost:5000` with nodemon.

## API Overview

| Area | Base route | Notes |
|---|---|---|
| Auth | `/api/auth` | register, login, refresh, logout, verify-email, forgot/reset password |
| Products | `/api/products` | list (search/filter/sort/paginate via query params), detail, admin CRUD, reviews |
| Categories | `/api/categories` | list + admin CRUD |
| Cart | `/api/cart` | per-user cart (auth required) |
| Orders | `/api/orders` | create (COD or Razorpay), verify payment, my-orders, cancel, return, admin list/status update |
| Coupons | `/api/coupons` | apply (user), admin CRUD |
| Users | `/api/users` | profile, addresses, wishlist, recently viewed, admin list/update |
| Admin | `/api/admin` | dashboard stats, revenue chart, top products, low stock |

Product listing supports: `?keyword=phone&category=<id>&price[gte]=100&price[lte]=5000&sort=-price&page=1&limit=12`

## Security implemented

Helmet, CORS (locked to `CLIENT_URL`), rate limiting (general + stricter on auth routes), Mongo query sanitization, XSS input sanitization, bcrypt password hashing, httpOnly cookies for tokens, input validation via `express-validator`, centralized error handling that never leaks stack traces in production.

## Deployment

**Backend → Render or Railway:**
1. Push this `backend/` folder to a GitHub repo.
2. Create a new Web Service, connect the repo, root directory = `backend`.
3. Build command: `npm install`. Start command: `npm start`.
4. Add all `.env` variables in the platform's environment variable settings (never commit `.env`).
5. Set `NODE_ENV=production` and `CLIENT_URL` to your deployed frontend URL.

**Database → MongoDB Atlas:** already cloud-hosted once you set `MONGO_URI` — no extra deployment step needed. For production, restrict IP access list to your backend host's IP instead of `0.0.0.0/0`.

**Images → Cloudinary:** already cloud-hosted via the API — no extra deployment step.

## Phase 2 Roadmap (not in this MVP — discuss timeline/cost with client separately)

- Google / GitHub OAuth login
- Stripe (international payments) alongside Razorpay
- AI-based product recommendations
- Voice search & image search
- Live chat support
- PWA support (offline mode, installable app)
- Multi-language & currency switcher
- Wishlist sharing
- PDF invoice generation
- Product comparison tool
- Real-time notifications (WebSocket)

These were scoped out of the MVP because they each require significant additional integration work, third-party accounts/costs, and testing time beyond a 1–2 week build.
