const router = require('express').Router();
const Product = require('../models/Product');
const config = require('../config');
const razorpay = require('../lib/razorpay');
const { priceCart } = require('../lib/cart');
const coupons = require('../lib/coupons');
const cloudinary = require('../lib/cloudinary');
const { z, parse, objectId } = require('../lib/validate');
const { notFound } = require('../lib/http');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/config', (_req, res) =>
  res.json({
    razorpayKeyId: razorpay.enabled() ? razorpay.keyId : null,
    uploadsEnabled: cloudinary.enabled(),
    freeShippingOver: config.freeShippingOver,
    shippingFee: config.shippingFee,
    maxQtyPerLine: config.maxQtyPerLine,
  })
);

const listQuery = z.object({
  q: z.string().trim().max(60).optional(),
  category: z.string().trim().max(60).optional(),
  brand: z.string().trim().max(300).optional(), // comma separated
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  inStock: z.enum(['1']).optional(),
  featured: z.enum(['1']).optional(),
  sort: z.enum(['new', 'price_asc', 'price_desc', 'rating']).default('new'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

const SORTS = { new: { createdAt: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 }, rating: { ratingAvg: -1, ratingCount: -1, createdAt: -1 } };

// ponytail: regex search is fine for a catalog of a few thousand products; move to a text/Atlas Search index beyond that.
const buildFilter = (p, { includeInactive = false } = {}) => {
  const f = includeInactive ? {} : { active: true };
  if (p.category) f.category = p.category;
  if (p.brand) f.brand = { $in: p.brand.split(',').map((b) => b.trim()).filter(Boolean) };
  if (p.minPrice != null || p.maxPrice != null) {
    f.price = {};
    if (p.minPrice != null) f.price.$gte = p.minPrice;
    if (p.maxPrice != null) f.price.$lte = p.maxPrice;
  }
  if (p.inStock) f.stock = { $gt: 0 };
  if (p.featured) f.featured = true;
  if (p.q) {
    const rx = new RegExp(escapeRegex(p.q), 'i');
    f.$or = [{ title: rx }, { brand: rx }, { category: rx }];
  }
  return f;
};

router.get('/products', async (req, res) => {
  const p = parse(listQuery, req.query);
  const filter = buildFilter(p);
  const [items, total] = await Promise.all([
    Product.find(filter).sort(SORTS[p.sort]).skip((p.page - 1) * p.limit).limit(p.limit),
    Product.countDocuments(filter),
  ]);
  res.json({ items, total, page: p.page, pages: Math.max(1, Math.ceil(total / p.limit)) });
});

router.get('/facets', async (_req, res) => {
  const [r] = await Product.aggregate([
    { $match: { active: true } },
    {
      $facet: {
        categories: [{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
        brands: [{ $group: { _id: '$brand', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
        price: [{ $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }],
      },
    },
  ]);
  res.json({
    categories: r.categories.map((c) => ({ name: c._id, count: c.count })),
    brands: r.brands.map((c) => ({ name: c._id, count: c.count })),
    price: r.price[0] ? { min: r.price[0].min, max: r.price[0].max } : { min: 0, max: 0 },
  });
});

router.get('/products/:slug', async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, active: true });
  if (!product) throw notFound('Product not found');
  const related = await Product.find({ active: true, category: product.category, _id: { $ne: product._id } })
    .sort({ featured: -1, createdAt: -1 })
    .limit(4);
  res.json({ product, related });
});

const quoteBody = z.object({
  items: z.array(z.object({ productId: objectId, qty: z.number().int().min(1).max(999) })).max(30),
  coupon: z.string().trim().max(20).optional(),
});

// The cart lives in the browser as ids + quantities. This returns live prices, stock and any coupon discount.
router.post('/cart/quote', async (req, res) => {
  const { items, coupon } = parse(quoteBody, req.body);
  const pricing = await priceCart(items);
  let discount = 0;
  let couponCode = null;
  let couponError = null;
  if (coupon) {
    try {
      const r = await coupons.evaluate(coupon, pricing.subtotal, req.user?._id);
      discount = r.discount;
      couponCode = r.coupon.code;
    } catch (e) {
      if (!e.status) throw e;
      couponError = e.message; // shown next to the coupon box; the cart itself still prices fine
    }
  }
  res.json({
    ...pricing,
    discount,
    couponCode,
    couponError,
    total: pricing.subtotal - discount + pricing.shipping,
    freeShippingOver: config.freeShippingOver,
  });
});

module.exports = router;
module.exports.buildFilter = buildFilter;
module.exports.listQuery = listQuery;
module.exports.SORTS = SORTS;
