const Product = require('../models/Product');
const config = require('../config');

const shippingFor = (subtotal) => (subtotal === 0 || subtotal >= config.freeShippingOver ? 0 : config.shippingFee);

// Prices a cart from the database. Client-supplied prices are never trusted.
// items: [{ productId, qty }]. Returns lines for every item (missing products are dropped).
exports.priceCart = async (items) => {
  const merged = new Map();
  for (const { productId, qty } of items) merged.set(productId, (merged.get(productId) || 0) + qty);

  const products = await Product.find({ _id: { $in: [...merged.keys()] }, active: true }).lean();
  const lines = products.map((p) => {
    const wanted = Math.min(merged.get(String(p._id)), config.maxQtyPerLine);
    const qty = Math.min(wanted, p.stock);
    return {
      id: String(p._id),
      slug: p.slug,
      title: p.title,
      image: p.images?.[0] || '',
      category: p.category,
      brand: p.brand,
      price: p.price,
      mrp: p.mrp && p.mrp > p.price ? p.mrp : null,
      stock: p.stock,
      wanted,
      qty, // clamped to stock; 0 means sold out
    };
  });
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const shipping = shippingFor(subtotal);
  return { lines, subtotal, shipping, total: subtotal + shipping };
};

exports.shippingFor = shippingFor;
