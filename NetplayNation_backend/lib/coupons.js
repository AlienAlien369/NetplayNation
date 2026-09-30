const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const { HttpError } = require('./http');

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Checks a code against a cart subtotal and returns { coupon, discount }, or throws a 400 with a customer-friendly reason.
// userId is optional: guests are checked again when they place the order.
exports.evaluate = async (rawCode, subtotal, userId) => {
  const code = String(rawCode || '').trim().toUpperCase();
  const coupon = code && (await Coupon.findOne({ code, active: true }));
  if (!coupon) throw new HttpError(400, 'This coupon code is not valid.');
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new HttpError(400, 'This coupon has expired.');
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) throw new HttpError(400, 'This coupon has been fully redeemed.');
  if (subtotal < coupon.minSubtotal) throw new HttpError(400, `Add ${rupees(coupon.minSubtotal - subtotal)} more to use this coupon.`);
  if (userId) {
    // ponytail: check-then-redeem can be raced by one customer placing simultaneous orders; add a per-user redemption ledger if abuse appears.
    const used = await Order.countDocuments({ user: userId, couponCode: coupon.code, status: { $ne: 'cancelled' } });
    if (used >= coupon.perUserLimit) throw new HttpError(400, 'You have already used this coupon.');
  }
  let discount = coupon.type === 'percent' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
  if (coupon.type === 'percent' && coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.max(0, Math.min(discount, subtotal - 1)); // an order can never be free
  return { coupon, discount };
};

// Atomically takes one redemption. Returns false if the coupon just ran out.
exports.redeem = async (coupon) => {
  const won = await Coupon.findOneAndUpdate(
    { _id: coupon._id, active: true, $expr: { $or: [{ $eq: [{ $ifNull: ['$usageLimit', null] }, null] }, { $lt: ['$usedCount', '$usageLimit'] }] } },
    { $inc: { usedCount: 1 } }
  );
  return Boolean(won);
};

exports.release = (id) => Coupon.updateOne({ _id: id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
