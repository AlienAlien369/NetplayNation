const router = require('express').Router();
const Product = require('../models/Product');
const Review = require('../models/Review');
const Order = require('../models/Order');
const { z, parse, objectId } = require('../lib/validate');
const { HttpError, notFound } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');

// "Riya Sharma" -> "Riya S." so reviews never expose a full name.
const publicName = (name) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first;
};

async function refreshRating(productId) {
  const [r] = await Review.aggregate([
    { $match: { product: productId } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne({ _id: productId }, { ratingAvg: r ? Math.round(r.avg * 10) / 10 : 0, ratingCount: r ? r.count : 0 });
}

const shape = (r) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, author: r.authorName, createdAt: r.createdAt });

const reviewBody = z.object({
  rating: z.coerce.number().int().min(1, 'choose a rating from 1 to 5').max(5, 'choose a rating from 1 to 5'),
  title: z.string().trim().max(80).default(''),
  body: z.string().trim().max(1500).default(''),
});

router.get('/products/:slug/reviews', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const product = await Product.findOne({ slug: req.params.slug, active: true }).select('_id ratingAvg ratingCount');
  if (!product) throw notFound('Product not found');

  const [items, total, breakdown] = await Promise.all([
    Review.find({ product: product._id }).sort({ createdAt: -1 }).skip((page - 1) * 10).limit(10),
    Review.countDocuments({ product: product._id }),
    Review.aggregate([{ $match: { product: product._id } }, { $group: { _id: '$rating', n: { $sum: 1 } } }]),
  ]);

  let me = null;
  if (req.user) {
    const [mine, delivered] = await Promise.all([
      Review.findOne({ product: product._id, user: req.user._id }),
      Order.exists({ user: req.user._id, status: 'delivered', 'items.product': product._id }),
    ]);
    me = { canReview: Boolean(delivered), review: mine ? shape(mine) : null };
  }
  res.json({
    items: items.map(shape),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / 10)),
    summary: {
      avg: product.ratingAvg,
      count: product.ratingCount,
      breakdown: Object.fromEntries([5, 4, 3, 2, 1].map((s) => [s, breakdown.find((b) => b._id === s)?.n || 0])),
    },
    me,
  });
});

router.post('/products/:slug/reviews', requireAuth, async (req, res) => {
  const body = parse(reviewBody, req.body);
  const product = await Product.findOne({ slug: req.params.slug, active: true }).select('_id');
  if (!product) throw notFound('Product not found');
  const delivered = await Order.exists({ user: req.user._id, status: 'delivered', 'items.product': product._id });
  if (!delivered) throw new HttpError(403, 'Only customers who received this product can review it.');

  const review = await Review.findOneAndUpdate(
    { product: product._id, user: req.user._id },
    { ...body, authorName: publicName(req.user.name) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await refreshRating(product._id);
  res.status(201).json({ review: shape(review) });
});

router.delete('/reviews/:id', requireAuth, async (req, res) => {
  const review = await Review.findById(parse(objectId, req.params.id));
  if (!review) throw notFound('Review not found');
  if (String(review.user) !== String(req.user._id) && req.user.role !== 'admin') throw new HttpError(403, 'You can only delete your own review');
  await review.deleteOne();
  await refreshRating(review.product);
  res.json({ ok: true });
});

module.exports = router;
