const crypto = require('crypto');
const Product = require('../models/Product');
const Order = require('../models/Order');
const config = require('../config');
const razorpay = require('./razorpay');
const { HttpError } = require('./http');
const { shippingFor } = require('./cart');
const coupons = require('./coupons');

const MAX_UNPAID = 3; // unpaid online orders one customer may hold stock with at once

const orderNumber = () => {
  const d = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `NP-${d}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

const restock = (items) =>
  Promise.all(items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.qty } })));
exports.restock = restock;

// Atomically takes stock for each line; if any line is short, gives back what was taken.
async function reserve(wanted) {
  const taken = [];
  for (const w of wanted) {
    const res = await Product.updateOne(
      { _id: w.product._id, active: true, stock: { $gte: w.qty } },
      { $inc: { stock: -w.qty } }
    );
    if (res.modifiedCount !== 1) {
      await restock(taken.map((t) => ({ product: t.product._id, qty: t.qty })));
      throw new HttpError(409, `"${w.product.title}" no longer has ${w.qty} in stock. Please update your cart.`);
    }
    taken.push(w);
  }
}

exports.createOrder = async ({ user, items, address, paymentMethod, couponCode }) => {
  if (paymentMethod === 'razorpay' && !razorpay.enabled()) {
    throw new HttpError(400, 'Online payment is not available right now. Please choose Cash on Delivery.');
  }
  const merged = new Map();
  for (const { productId, qty } of items) merged.set(productId, (merged.get(productId) || 0) + qty);
  if ([...merged.values()].some((q) => q > config.maxQtyPerLine)) {
    throw new HttpError(400, `You can order at most ${config.maxQtyPerLine} of one item.`);
  }

  if (paymentMethod === 'razorpay' && (await Order.countDocuments({ user: user._id, status: 'pending_payment' })) >= MAX_UNPAID) {
    throw new HttpError(429, 'You have unpaid orders waiting. Please pay for or cancel them before placing another.');
  }

  const products = await Product.find({ _id: { $in: [...merged.keys()] }, active: true });
  if (products.length !== merged.size) throw new HttpError(409, 'Some items in your cart are no longer available.');
  const wanted = products.map((p) => ({ product: p, qty: merged.get(String(p._id)) }));

  await reserve(wanted);

  const orderItems = wanted.map(({ product: p, qty }) => ({
    product: p._id, title: p.title, slug: p.slug, image: p.images?.[0] || '', price: p.price, qty,
  }));
  const subtotal = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = shippingFor(subtotal);

  let order;
  let redeemed = null; // the coupon document, once a redemption has been taken
  try {
    let discount = 0;
    if (couponCode) {
      const result = await coupons.evaluate(couponCode, subtotal, user._id);
      if (!(await coupons.redeem(result.coupon))) throw new HttpError(400, 'This coupon has been fully redeemed.');
      redeemed = result.coupon;
      discount = result.discount;
    }
    const total = subtotal - discount + shipping;
    order = await Order.create({
      orderNumber: orderNumber(),
      user: user._id,
      items: orderItems,
      address,
      subtotal, shipping, discount, total,
      couponCode: redeemed?.code,
      couponId: redeemed?._id,
      paymentMethod,
      status: paymentMethod === 'cod' ? 'placed' : 'pending_payment',
    });
    if (redeemed) {
      // Simultaneous orders can all pass the earlier per-customer check; only the first perUserLimit (by creation order) may keep the discount.
      const earlier = await Order.countDocuments({ user: user._id, couponId: redeemed._id, status: { $ne: 'cancelled' }, _id: { $lt: order._id } });
      if (earlier >= redeemed.perUserLimit) throw new HttpError(400, 'You have already used this coupon.');
    }
    if (paymentMethod === 'razorpay') {
      const rzp = await razorpay.createOrder({ amountRupees: total, receipt: order.orderNumber });
      order.razorpayOrderId = rzp.id;
      await order.save();
    }
  } catch (err) {
    await restock(orderItems);
    if (redeemed) await coupons.release(redeemed._id);
    if (order) await Order.deleteOne({ _id: order._id });
    throw err.status ? err : new HttpError(502, 'Could not start payment. Please try again.');
  }
  return order;
};

exports.paymentParams = (order) => ({
  keyId: razorpay.keyId,
  razorpayOrderId: order.razorpayOrderId,
  amount: order.total * 100,
});

// Cancels an order only if it is still in one of the `from` states, returns its stock and coupon redemption.
// Returns the cancelled order, or null if the order had already moved on (so nothing is restocked twice or after shipping).
exports.cancelOrder = async (order, from) => {
  const won = await Order.findOneAndUpdate({ _id: order._id, status: { $in: from } }, { status: 'cancelled' }, { new: true });
  if (!won) return null;
  await restock(won.items);
  if (won.couponId) await coupons.release(won.couponId);
  return won;
};

// Records a captured online payment. Shared by the browser verify call and the Razorpay webhook.
// Payment and status are claimed with separate atomic updates so a concurrent cancel or expiry can never leave a
// paid order restocked: if the order was cancelled first, the payment is refunded instead.
// Returns 'placed', 'refunded' (order was already cancelled), 'failed' (refund needs a retry) or 'duplicate' (already handled).
exports.confirmPayment = async (orderId, paymentId) => {
  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: 'pending' },
    { paymentStatus: 'paid', razorpayPaymentId: paymentId },
    { new: true }
  );
  if (!claimed) return { outcome: 'duplicate' };
  const placed = await Order.findOneAndUpdate({ _id: orderId, status: 'pending_payment' }, { status: 'placed' }, { new: true });
  if (placed) return { outcome: 'placed', order: placed };
  const refund = await exports.refundIfPaid(claimed);
  return { outcome: refund === 'failed' ? 'failed' : 'refunded', order: await Order.findById(orderId) };
};

// Refunds a paid online order in full. Safe to call repeatedly: only one caller can claim the refund.
// Returns 'refunded', 'failed' (an admin can retry), or 'none' (nothing to refund).
exports.refundIfPaid = async (order) => {
  if (order.paymentMethod !== 'razorpay') return 'none';
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: 'paid', razorpayPaymentId: { $exists: true } },
    { paymentStatus: 'refunding' },
    { new: true }
  );
  if (!claimed) return 'none';
  try {
    const r = await razorpay.refund(claimed.razorpayPaymentId, claimed.total);
    await Order.updateOne({ _id: order._id }, { paymentStatus: 'refunded', refundId: r.id, refundFailed: false });
    return 'refunded';
  } catch (err) {
    console.error(`[refund] failed for ${order.orderNumber}:`, err.message);
    await Order.updateOne({ _id: order._id }, { paymentStatus: 'paid', refundFailed: true });
    return 'failed';
  }
};

// Cancels an order, returns its stock, and refunds it if it was paid online.
// Repeating the call on an already-cancelled order is harmless; if the order has moved past `from` (for example
// it was just shipped) this throws 409 instead of refunding goods that are on their way.
exports.cancelAndRefund = async (order, from) => {
  const won = await exports.cancelOrder(order, from);
  const current = await Order.findById(order._id);
  if (!won && current.status !== 'cancelled') {
    throw new HttpError(409, `This order is now ${current.status.replace('_', ' ')} and can no longer be cancelled. Please refresh and contact support if needed.`);
  }
  const refund = await exports.refundIfPaid(current);
  return { order: await Order.findById(order._id), refund };
};

// Releases stock held by online-payment orders that were never paid.
exports.expireUnpaidOrders = async (now = Date.now()) => {
  const cutoff = new Date(now - config.unpaidOrderTtlMs);
  const stale = await Order.find({ status: 'pending_payment', paymentStatus: 'pending', createdAt: { $lt: cutoff } });
  let n = 0;
  for (const o of stale) if (await exports.cancelOrder(o, ['pending_payment'])) n += 1;
  return n;
};
