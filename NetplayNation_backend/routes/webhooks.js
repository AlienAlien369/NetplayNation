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

  // Claim the order atomically so the browser verify call and this webhook cannot both act on it.
  const wasCancelled = order.status === 'cancelled';
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: 'pending' },
    { paymentStatus: 'paid', razorpayPaymentId: payment.id, ...(wasCancelled ? {} : { status: 'placed' }) },
    { new: true }
  );
  if (!claimed) return res.json({ ok: true });

  if (wasCancelled) await orders.refundIfPaid(claimed); // the order had expired: give the money back
  else emails.orderPlaced(claimed, order.user);
  res.json({ ok: true });
};
