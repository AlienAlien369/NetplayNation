# Netplay Nation

Sports e-commerce store. One Node service (Express + MongoDB) serves the API and the built React app.

## Run locally
```bash
cd NetplayNation_backend && npm install && npm run dev      # API on :4000, in-memory DB, demo data
cd NetplayNation_frontend && npm install && npm run dev     # storefront on :5173 (proxies /api)
```
Dev admin login: `admin@netplay.test` / `admin12345` (in-memory dev database only).

## Test
```bash
cd NetplayNation_backend && npm test
cd NetplayNation_frontend && npm run lint && npm run build
```

## Production
1. Create a MongoDB Atlas cluster and copy its connection string.
2. Deploy with `render.yaml` (Render Blueprint) or any Node host: build the frontend, then `node NetplayNation_backend/index.js`.
3. Set env vars from `NetplayNation_backend/.env.example`: `MONGODB_URL`, `JWT_SECRET`, optional `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (without them the store runs Cash on Delivery only).
4. Create the first admin once: `ADMIN_EMAIL=you@x.com ADMIN_PASSWORD=... npm run seed` (add `-- --demo` for sample products).
