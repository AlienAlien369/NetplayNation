const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');
const { expireUnpaidOrders } = require('./lib/orders');

async function main() {
  if (!config.mongoUrl) throw new Error('MONGODB_URL is not set. Copy .env.example to .env, or run `npm run dev` for an in-memory database.');
  await mongoose.connect(config.mongoUrl);
  console.log('MongoDB connected');

  if (process.env.DEV_MEMORY_DB) {
    const { seed } = require('./seed');
    await seed({ adminEmail: 'admin@netplay.test', adminPassword: 'admin12345', demo: true });
    console.log('Dev database seeded. Admin login: admin@netplay.test / admin12345');
  }

  const server = app.listen(config.port, () => console.log(`Server listening on http://localhost:${config.port}`));

  // ponytail: single-instance timer; use a shared scheduler/lock if you ever run more than one instance.
  const timer = setInterval(() => expireUnpaidOrders().catch((e) => console.error('expire job failed', e)), 10 * 60 * 1000);
  timer.unref();

  const stop = () => server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
