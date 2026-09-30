const crypto = require('crypto');
const Razorpay = require('razorpay');
const config = require('../config');

const { keyId, keySecret } = config.razorpay;
const client = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;

// Exposed as an object so tests can stub `createOrder`.
module.exports = {
  enabled: () => Boolean(client),
  keyId,
  createOrder: ({ amountRupees, receipt }) =>
    client.orders.create({ amount: amountRupees * 100, currency: 'INR', receipt }),
  verifySignature: (orderId, paymentId, signature) => {
    const expected = crypto.createHmac('sha256', config.razorpay.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },
};
