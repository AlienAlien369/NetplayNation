# Netplay Nation

Sports e-commerce store. One Node service (Express + MongoDB) serves the API and the built React app.

**Storefront:** catalog with search, filters and sort, product pages with ratings and reviews, wishlist, cart with coupons, checkout with Cash on Delivery or Razorpay, order tracking and cancellation with automatic refunds, password reset, order emails.
**Admin (`/admin`):** dashboard, products with photo upload, orders (pack, ship, deliver, cancel, retry refund), coupons.

## Run locally
```bash
cd NetplayNation_backend && npm install && npm run dev      # API on :4000, in-memory DB, demo data
cd NetplayNation_frontend && npm install && npm run dev     # storefront on :5173 (proxies /api)
```
Dev admin login: `admin@netplay.test` / `admin12345` (in-memory dev database only). Demo coupon: `WELCOME10`.
In development, emails are printed to the backend console instead of being sent.

## Test
```bash
cd NetplayNation_backend && npm test                        # 60 API tests against an in-memory MongoDB
cd NetplayNation_frontend && npm run lint && npm run build
```

## Production
1. Create a MongoDB Atlas cluster and copy its connection string.
2. Deploy with `render.yaml` (Render Blueprint) or any Node host: build the frontend, then `node NetplayNation_backend/index.js`.
3. Set env vars (see `NetplayNation_backend/.env.example`):

| Variable | Needed for |
| --- | --- |
| `MONGODB_URL`, `JWT_SECRET`, `APP_URL` | Required in production |
| `SMTP_URL`, `MAIL_FROM` | Order emails and password reset (any SMTP provider, e.g. Brevo or Resend) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Online payments (without them the store runs Cash on Delivery only) |
| `RAZORPAY_WEBHOOK_SECRET` | Safety net for customers who pay and close the tab (see below) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Photo upload in the admin panel (otherwise admins paste image links) |

4. **Razorpay webhook:** in the Razorpay dashboard add a webhook to `https://YOUR-DOMAIN/api/webhooks/razorpay`, enable `payment.captured` and `order.paid`, and put its secret in `RAZORPAY_WEBHOOK_SECRET`. Without it, a customer who pays but never returns to the site is only reconciled by the refund path.
5. Create the first admin once: `ADMIN_EMAIL=you@x.com ADMIN_PASSWORD=... npm run seed` (add `-- --demo` for sample products and a demo coupon).

## Notes for operators
- Prices are whole rupees, tax-inclusive. Shipping is free from Rs. 999, otherwise Rs. 79 (`NetplayNation_backend/config.js`).
- Unpaid online orders release their stock after 30 minutes. A payment that arrives for an expired order is refunded automatically.
- Review the policy pages (`NetplayNation_frontend/src/pages/Static.jsx`) and contact details (`src/site.js`) before launch.
