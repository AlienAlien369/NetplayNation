const router = require('express').Router();
const crypto = require('crypto');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const orders = require('../lib/orders');
const emails = require('../lib/emails');
const { buildFilter, listQuery, SORTS } = require('./shop');
const { z, parse, objectId } = require('../lib/validate');
const { HttpError, notFound } = require('../lib/http');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

const slugify = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'product';

const productBody = z
  .object({
    title: z.string().trim().min(3).max(140),
    description: z.string().trim().max(4000).default(''),
    brand: z.string().trim().min(1).max(60),
    category: z.string().trim().min(1).max(60),
    price: z.coerce.number().int().min(1),
    mrp: z.coerce.number().int().min(1).nullish(),
    stock: z.coerce.number().int().min(0),
    images: z.array(z.string().trim().max(500).regex(/^https?:\/\/\S+$/i, 'must be an http(s) link')).max(8).default([]),
    featured: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .refine((p) => !p.mrp || p.mrp >= p.price, { message: 'must not be lower than the selling price', path: ['mrp'] });

async function uniqueSlug(title) {
  const base = slugify(title);
  return (await Product.exists({ slug: base })) ? `${base}-${crypto.randomBytes(2).toString('hex')}` : base;
}

router.get('/stats', async (_req, res) => {
  const week = new Date(Date.now() - 7 * 864e5);
  const counted = { status: { $nin: ['cancelled', 'pending_payment'] } };
  const [byStatus, revenue, customers, lowStock] = await Promise.all([
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { ...counted, createdAt: { $gte: week } } },
      { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
    ]),
    User.countDocuments({ role: 'customer' }),
    Product.find({ active: true, stock: { $lte: 5 } }).sort({ stock: 1 }).limit(10).select('title slug stock'),
  ]);
  res.json({
    ordersByStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
    last7Days: { revenue: revenue[0]?.revenue || 0, orders: revenue[0]?.orders || 0 },
    customers,
    lowStock,
  });
});

router.get('/products', async (req, res) => {
  const p = parse(listQuery.extend({ limit: z.coerce.number().int().min(1).max(100).default(20) }), req.query);
  const filter = buildFilter(p, { includeInactive: true });
  const [items, total] = await Promise.all([
    Product.find(filter).sort(SORTS[p.sort]).skip((p.page - 1) * p.limit).limit(p.limit),
    Product.countDocuments(filter),
  ]);
  res.json({ items, total, page: p.page, pages: Math.max(1, Math.ceil(total / p.limit)) });
});

router.get('/products/:id', async (req, res) => {
  const product = await Product.findById(parse(objectId, req.params.id));
  if (!product) throw notFound('Product not found');
  res.json({ product });
});

router.post('/products', async (req, res) => {
  const body = parse(productBody, req.body);
  res.status(201).json({ product: await Product.create({ ...body, slug: await uniqueSlug(body.title) }) });
});

router.put('/products/:id', async (req, res) => {
  const body = parse(productBody, req.body);
  const product = await Product.findByIdAndUpdate(parse(objectId, req.params.id), body, { new: true });
  if (!product) throw notFound('Product not found');
  res.json({ product });
});

router.delete('/products/:id', async (req, res) => {
  const product = await Product.findByIdAndDelete(parse(objectId, req.params.id));
  if (!product) throw notFound('Product not found');
  res.json({ ok: true });
});

const STATUSES = ['pending_payment', 'placed', 'packed', 'shipped', 'delivered', 'cancelled'];

router.get('/orders', async (req, res) => {
  const { status, page } = parse(
    z.object({ status: z.enum(STATUSES).optional(), page: z.coerce.number().int().min(1).default(1) }),
    req.query
  );
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 20).limit(20).populate('user', 'name email'),
    Order.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / 20)) });
});

const NEXT = {
  pending_payment: ['cancelled'],
  placed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

router.patch('/orders/:id', async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(STATUSES) }), req.body);
  const order = await Order.findById(parse(objectId, req.params.id)).populate('user', 'name email');
  if (!order) throw notFound('Order not found');
  if (!NEXT[order.status].includes(status)) {
    throw new HttpError(400, `Cannot move an order from ${order.status} to ${status}`);
  }
  if (status === 'cancelled') {
    const { order: cancelled, refund } = await orders.cancelAndRefund(order);
    emails.orderCancelled(cancelled, order.user, { refunded: refund === 'refunded' });
    return res.json({ order: cancelled, refund });
  }
  order.status = status;
  if (status === 'delivered' && order.paymentMethod === 'cod') order.paymentStatus = 'paid';
  await order.save();
  if (status === 'shipped') emails.orderShipped(order, order.user);
  res.json({ order });
});

router.post('/orders/:id/refund', async (req, res) => {
  const order = await Order.findById(parse(objectId, req.params.id));
  if (!order) throw notFound('Order not found');
  if (order.status !== 'cancelled') throw new HttpError(400, 'Only cancelled orders can be refunded');
  const refund = await orders.refundIfPaid(order);
  if (refund === 'none') throw new HttpError(400, 'Nothing to refund on this order');
  res.json({ order: await Order.findById(order._id), refund });
});

module.exports = router;
