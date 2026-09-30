require('dotenv').config({ quiet: true });

const prod = process.env.NODE_ENV === 'production';
const need = (k) => {
  if (!process.env[k]) throw new Error(`Missing required env var ${k}`);
  return process.env[k];
};

module.exports = {
  prod,
  port: Number(process.env.PORT) || 4000,
  mongoUrl: prod ? need('MONGODB_URL') : process.env.MONGODB_URL,
  jwtSecret: prod ? need('JWT_SECRET') : process.env.JWT_SECRET || 'dev-only-secret',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },
  // Prices are whole rupees. Shipping is free at or above the threshold.
  freeShippingOver: 999,
  shippingFee: 79,
  maxQtyPerLine: 10,
  unpaidOrderTtlMs: 30 * 60 * 1000,
};
