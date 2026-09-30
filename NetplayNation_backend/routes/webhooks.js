const Order = require('../models/Order');
const razorpay = require('../lib/razorpay');
const orders = require('../lib/orders');
const emails = require('../lib/emails');

// Razorpay calls this when a payment is captured, even if the customer closed the tab before we could verify it.
// Mounted with a raw body parser: the signature covers the exact bytes Razorpay sent.
module.exports = async (req, res) => {
  if (!razorpay.webhookEnabled()) return res.status(503).json({ error: 'Webhook not configured' });
  if (!Buffer.isBuffer(req.body) || !razorpay.verifyWebhook(req.body, req.get('x-razorpay-signature'))) {
    return res.status(400).json({ error: 'Invalid signature' });
  }
  const event = JSON.parse(req.body.toString('utf8'));
  const payment = event.payload?.payment?.entity;
  if (!['payment.captured', 'order.paid'].includes(event.event) || !payment?.order_id) return res.json({ ok: true, ignored: true });

  const order = await Order.findOne({ razorpayOrderId: payment.order_id }).populate('user', 'name email');
  if (!order || order.paymentStatus !== 'pending') return res.json({ ok: true }); // unknown or already handled
  if (payment.amount !== order.total * 100) {
    console.error(`[webhook] amount mismatch for ${order.orderNumber}: paid ${payment.amount}, expected ${order.total * 100}`);
    return res.json({ ok: true, ignored: true });
  }

  // Same atomic path as the browser verify call, so the two can never both act on one order.
  const { outcome, order: fresh } = await orders.confirmPayment(order._id, payment.id);
  if (outcome === 'placed') emails.orderPlaced(fresh, order.user);
  res.json({ ok: true });
};
