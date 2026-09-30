const router = require('express').Router();
const Order = require('../models/Order');
const razorpay = require('../lib/razorpay');
const orders = require('../lib/orders');
const { z, parse, objectId } = require('../lib/validate');
const { HttpError, notFound } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

const address = z.object({
  name: z.string().trim().min(2, 'enter the recipient name').max(80),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'enter a 10-digit mobile number'),
  line1: z.string().trim().min(3, 'enter the address').max(120),
  line2: z.string().trim().max(120).optional().default(''),
  city: z.string().trim().min(2, 'enter the city').max(60),
  state: z.string().trim().min(2, 'choose the state').max(40),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'enter a 6-digit pincode'),
});
const createBody = z.object({
  items: z
    .array(z.object({ productId: objectId, qty: z.number().int().min(1).max(999) }))
    .min(1, 'your cart is empty')
    .max(30),
  address,
  paymentMethod: z.enum(['cod', 'razorpay']),
});
const verifyBody = z.object({
  razorpay_order_id: z.string().max(60),
  razorpay_payment_id: z.string().max(60),
  razorpay_signature: z.string().max(200),
});

const mine = async (req) => {
  const order = await Order.findOne({ _id: parse(objectId, req.params.id), user: req.user._id });
  if (!order) throw notFound('Order not found');
  return order;
};

router.post('/', async (req, res) => {
  const body = parse(createBody, req.body);
  const order = await orders.createOrder({ user: req.user, ...body });
  res.status(201).json({
    order,
    payment: order.paymentMethod === 'razorpay' ? orders.paymentParams(order) : null,
  });
});

router.get('/', async (req, res) => {
  res.json({ orders: await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50) });
});

router.get('/:id', async (req, res) => {
  const order = await mine(req);
  res.json({ order, payment: order.status === 'pending_payment' ? orders.paymentParams(order) : null });
});

router.post('/:id/verify', async (req, res) => {
  const b = parse(verifyBody, req.body);
  const order = await mine(req);
  if (order.paymentStatus === 'paid') return res.json({ order }); // idempotent
  if (order.paymentMethod !== 'razorpay' || order.razorpayOrderId !== b.razorpay_order_id) {
    throw new HttpError(400, 'Payment does not match this order');
  }
  if (!razorpay.verifySignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) {
    throw new HttpError(400, 'Payment could not be verified');
  }
  if (order.status === 'cancelled') {
    throw new HttpError(409, 'This order expired before payment completed. Any amount debited will be refunded.');
  }
  order.paymentStatus = 'paid';
  order.razorpayPaymentId = b.razorpay_payment_id;
  order.status = 'placed';
  await order.save();
  res.json({ order });
});

router.post('/:id/cancel', async (req, res) => {
  const order = await mine(req);
  const cancellable = order.status === 'pending_payment' || (order.status === 'placed' && order.paymentStatus !== 'paid');
  if (!cancellable) throw new HttpError(400, 'This order can no longer be cancelled online. Please contact support.');
  res.json({ order: await orders.cancelOrder(order) });
});

module.exports = router;
