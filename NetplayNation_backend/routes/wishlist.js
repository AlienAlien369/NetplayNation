const router = require('express').Router();
const Product = require('../models/Product');
const User = require('../models/User');
const { parse, objectId } = require('../lib/validate');
const { HttpError, notFound } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

const MAX_ITEMS = 200;

router.get('/', async (req, res) => {
  const ids = req.user.wishlist.map(String);
  const products = await Product.find({ _id: { $in: ids }, active: true });
  const byId = new Map(products.map((p) => [String(p._id), p]));
  // Most recently saved first; products that were deleted or hidden silently drop out.
  res.json({ items: ids.reverse().map((id) => byId.get(id)).filter(Boolean), ids });
});

router.put('/:productId', async (req, res) => {
  const id = parse(objectId, req.params.productId);
  if (!(await Product.exists({ _id: id, active: true }))) throw notFound('Product not found');
  if (req.user.wishlist.length >= MAX_ITEMS && !req.user.wishlist.some((w) => String(w) === id)) {
    throw new HttpError(400, `Your wishlist is full (${MAX_ITEMS} items).`);
  }
  await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: id } });
  res.json({ ok: true });
});

router.delete('/:productId', async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: parse(objectId, req.params.productId) } });
  res.json({ ok: true });
});

module.exports = router;
