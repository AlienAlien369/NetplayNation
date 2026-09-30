const crypto = require('crypto');
const Product = require('../models/Product');
const Order = require('../models/Order');
const config = require('../config');
const razorpay = require('./razorpay');
const { HttpError } = require('./http');
const { shippingFor } = require('./cart');

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

exports.createOrder = async ({ user, items, address, paymentMethod }) => {
  if (paymentMethod === 'razorpay' && !razorpay.enabled()) {
    throw new HttpError(400, 'Online payment is not available right now. Please choose Cash on Delivery.');
  }
  const merged = new Map();
  for (const { productId, qty } of items) merged.set(productId, (merged.get(productId) || 0) + qty);
  if ([...merged.values()].some((q) => q > config.maxQtyPerLine)) {
    throw new HttpError(400, `You can order at most ${config.maxQtyPerLine} of one item.`);
  }

  const products = await Product.find({ _id: { $in: [...merged.keys()] }, active: true });
  if (products.length !== merged.size) throw new HttpError(409, 'Some items in your cart are no longer available.');
  const wanted = products.map((p) => ({ product: p, qty: merged.get(String(p._id)) }));

  await reserve(wanted);

  const orderItems = wanted.map(({ product: p, qty }) => ({
    product: p._id, title: p.title, image: p.images?.[0] || '', price: p.price, qty,
  }));
  const subtotal = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = shippingFor(subtotal);
  const total = subtotal + shipping;

  let order;
  try {
    order = await Order.create({
      orderNumber: orderNumber(),
      user: user._id,
      items: orderItems,
      address,
      subtotal, shipping, total,
      paymentMethod,
      status: paymentMethod === 'cod' ? 'placed' : 'pending_payment',
    });
    if (paymentMethod === 'razorpay') {
      const rzp = await razorpay.createOrder({ amountRupees: total, receipt: order.orderNumber });
      order.razorpayOrderId = rzp.id;
      await order.save();
    }
  } catch (err) {
    await restock(orderItems);
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

// Cancels an order and returns its stock. No-op if already cancelled.
exports.cancelOrder = async (order) => {
  const won = await Order.findOneAndUpdate(
    { _id: order._id, status: { $ne: 'cancelled' } },
    { status: 'cancelled' },
    { new: true }
  );
  if (!won) return order; // someone else cancelled first; don't restock twice
  await restock(won.items);
  return won;
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
exports.cancelAndRefund = async (order) => {
  await exports.cancelOrder(order);
  const refund = await exports.refundIfPaid(order);
  return { order: await Order.findById(order._id), refund };
};

// Releases stock held by online-payment orders that were never paid.
exports.expireUnpaidOrders = async (now = Date.now()) => {
  const cutoff = new Date(now - config.unpaidOrderTtlMs);
  const stale = await Order.find({ status: 'pending_payment', createdAt: { $lt: cutoff } });
  for (const o of stale) await exports.cancelOrder(o);
  return stale.length;
};
