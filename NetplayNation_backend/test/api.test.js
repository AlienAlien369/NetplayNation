process.env.NODE_ENV = 'test';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const razorpay = require('../lib/razorpay');
const { expireUnpaidOrders } = require('../lib/orders');
const { seed } = require('../seed');

let mongod;
before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('test'));
  await Promise.all([User.init(), Product.init(), Order.init()]);
});
after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({})]);
});

const address = { name: 'Riya Sharma', phone: '9876543210', line1: '12 MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411001' };

const mkProduct = (over = {}) =>
  Product.create({ title: 'Test Racket', slug: `test-racket-${crypto.randomBytes(3).toString('hex')}`, brand: 'Kestrel', category: 'Badminton', price: 1000, stock: 10, ...over });

async function signedIn(email = 'riya@example.com') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name: 'Riya', email, password: 'password123' });
  assert.equal(res.status, 201);
  return agent;
}
async function adminAgent() {
  await seed({ adminEmail: 'boss@example.com', adminPassword: 'password123' });
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: 'boss@example.com', password: 'password123' });
  assert.equal(res.status, 200);
  return agent;
}
const order = (agent, items, over = {}) =>
  agent.post('/api/orders').send({ items, address, paymentMethod: 'cod', ...over });

describe('auth', () => {
  test('register, session cookie, me, logout', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send({ name: 'Riya', email: 'Riya@Example.com', password: 'password123' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, 'riya@example.com');
    assert.equal(res.body.user.passwordHash, undefined);
    assert.match(res.headers['set-cookie'][0], /HttpOnly/i);
    assert.equal((await agent.get('/api/auth/me')).body.user.name, 'Riya');
    await agent.post('/api/auth/logout');
    assert.equal((await agent.get('/api/auth/me')).body.user, null);
  });

  test('rejects weak password, duplicate email, wrong password', async () => {
    assert.equal((await request(app).post('/api/auth/register').send({ name: 'A B', email: 'a@b.com', password: 'short' })).status, 400);
    await signedIn('dup@example.com');
    const dup = await request(app).post('/api/auth/register').send({ name: 'Other', email: 'dup@example.com', password: 'password123' });
    assert.equal(dup.status, 409);
    const bad = await request(app).post('/api/auth/login').send({ email: 'dup@example.com', password: 'wrongwrong' });
    assert.equal(bad.status, 401);
  });

  test('a customer can never self-assign admin via register', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Evil', email: 'evil@example.com', password: 'password123', role: 'admin' });
    assert.equal((await User.findOne({ email: 'evil@example.com' })).role, 'customer');
  });
});

describe('catalog', () => {
  test('filters, search, sort, pagination, inactive hidden', async () => {
    await Promise.all([
      mkProduct({ title: 'Aero Racket', price: 2000 }),
      mkProduct({ title: 'Budget Racket', price: 500 }),
      mkProduct({ title: 'Cricket Bat', category: 'Cricket', brand: 'Crease', price: 3000 }),
      mkProduct({ title: 'Hidden Thing', active: false }),
    ]);
    const all = (await request(app).get('/api/products')).body;
    assert.equal(all.total, 3);
    assert.equal((await request(app).get('/api/products?category=Cricket')).body.total, 1);
    assert.equal((await request(app).get('/api/products?q=racket&sort=price_asc')).body.items[0].title, 'Budget Racket');
    assert.equal((await request(app).get('/api/products?minPrice=1000&maxPrice=2500')).body.total, 1);
    assert.equal((await request(app).get('/api/products?limit=2&page=2')).body.items.length, 1);
    assert.equal((await request(app).get('/api/products?limit=2')).body.pages, 2);
  });

  test('search treats regex characters literally and validates input', async () => {
    await mkProduct({ title: 'Plain Racket' });
    const res = await request(app).get('/api/products').query({ q: '.*(' });
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 0);
    assert.equal((await request(app).get('/api/products?sort=evil')).status, 400);
  });

  test('facets and product by slug with related', async () => {
    const a = await mkProduct({ title: 'A' });
    await mkProduct({ title: 'B' });
    await mkProduct({ title: 'C', category: 'Cricket', brand: 'Crease' });
    const f = (await request(app).get('/api/facets')).body;
    assert.deepEqual(f.categories.map((c) => c.name), ['Badminton', 'Cricket']);
    const p = (await request(app).get(`/api/products/${a.slug}`)).body;
    assert.equal(p.product.title, 'A');
    assert.equal(p.related.length, 1);
    assert.equal((await request(app).get('/api/products/nope')).status, 404);
  });

  test('cart quote uses database prices and clamps to stock', async () => {
    const p = await mkProduct({ price: 1000, stock: 3 });
    const res = await request(app).post('/api/cart/quote').send({
      items: [{ productId: String(p._id), qty: 5 }, { productId: '507f1f77bcf86cd799439011', qty: 1 }],
      price: 1, // ignored
    });
    assert.equal(res.body.lines.length, 1);
    assert.equal(res.body.lines[0].qty, 3);
    assert.equal(res.body.subtotal, 3000);
    assert.equal(res.body.shipping, 0);
  });
});

describe('orders (COD)', () => {
  test('requires sign in', async () => {
    const p = await mkProduct();
    assert.equal((await request(app).post('/api/orders').send({ items: [{ productId: String(p._id), qty: 1 }], address, paymentMethod: 'cod' })).status, 401);
  });

  test('prices on the server, applies shipping, reduces stock', async () => {
    const agent = await signedIn();
    const cheap = await mkProduct({ price: 300, stock: 5 });
    const res = await order(agent, [{ productId: String(cheap._id), qty: 2 }]);
    assert.equal(res.status, 201);
    assert.equal(res.body.order.subtotal, 600);
    assert.equal(res.body.order.shipping, 79);
    assert.equal(res.body.order.total, 679);
    assert.equal(res.body.order.status, 'placed');
    assert.match(res.body.order.orderNumber, /^NP-\d{6}-[0-9A-F]{6}$/);
    assert.equal((await Product.findById(cheap._id)).stock, 3);

    const big = await mkProduct({ price: 1500, stock: 5 });
    const free = await order(agent, [{ productId: String(big._id), qty: 1 }]);
    assert.equal(free.body.order.shipping, 0);
  });

  test('merges duplicate lines and enforces per-item max', async () => {
    const agent = await signedIn();
    const p = await mkProduct({ stock: 50 });
    const id = String(p._id);
    assert.equal((await order(agent, [{ productId: id, qty: 6 }, { productId: id, qty: 6 }])).status, 400);
  });

  test('all-or-nothing: a short item rolls back earlier reservations', async () => {
    const agent = await signedIn();
    const a = await mkProduct({ title: 'Plenty', stock: 5 });
    const b = await mkProduct({ title: 'Scarce', stock: 1 });
    const res = await order(agent, [{ productId: String(a._id), qty: 2 }, { productId: String(b._id), qty: 2 }]);
    assert.equal(res.status, 409);
    assert.equal((await Product.findById(a._id)).stock, 5);
    assert.equal((await Product.findById(b._id)).stock, 1);
    assert.equal(await Order.countDocuments(), 0);
  });

  test('never oversells under concurrent checkout', async () => {
    const p = await mkProduct({ stock: 3 });
    const agents = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => signedIn(`u${i}@example.com`)));
    const results = await Promise.all(agents.map((a) => order(a, [{ productId: String(p._id), qty: 1 }])));
    assert.equal(results.filter((r) => r.status === 201).length, 3);
    assert.equal(results.filter((r) => r.status === 409).length, 3);
    assert.equal((await Product.findById(p._id)).stock, 0);
  });

  test('validates the address', async () => {
    const agent = await signedIn();
    const p = await mkProduct();
    const res = await order(agent, [{ productId: String(p._id), qty: 1 }], { address: { ...address, phone: '12345' } });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /mobile/);
  });

  test('cancel restocks once; other users cannot see the order', async () => {
    const agent = await signedIn();
    const p = await mkProduct({ stock: 5 });
    const { body } = await order(agent, [{ productId: String(p._id), qty: 2 }]);
    const id = body.order.id;
    const other = await signedIn('other@example.com');
    assert.equal((await other.get(`/api/orders/${id}`)).status, 404);
    assert.equal((await other.post(`/api/orders/${id}/cancel`)).status, 404);

    assert.equal((await agent.post(`/api/orders/${id}/cancel`)).status, 200);
    await agent.post(`/api/orders/${id}/cancel`);
    assert.equal((await Product.findById(p._id)).stock, 5);
    assert.equal((await agent.get('/api/orders')).body.orders.length, 1);
  });
});

describe('orders (Razorpay)', () => {
  const stub = () => {
    const orig = { createOrder: razorpay.createOrder, refund: razorpay.refund };
    razorpay.createOrder = async ({ amountRupees }) => ({ id: `order_${crypto.randomBytes(4).toString('hex')}`, amount: amountRupees * 100 });
    razorpay.refund = async () => ({ id: 'rfnd_test' });
    return () => Object.assign(razorpay, orig);
  };
  const sign = (o, p) => crypto.createHmac('sha256', 'rzp_test_secret').update(`${o}|${p}`).digest('hex');

  test('exposes the public key in config only', async () => {
    const cfg = (await request(app).get('/api/config')).body;
    assert.equal(cfg.razorpayKeyId, 'rzp_test_key');
    assert.ok(!JSON.stringify(cfg).includes('secret'));
  });

  test('pending until a valid signature is verified; verify is idempotent', async () => {
    const restore = stub();
    try {
      const agent = await signedIn();
      const p = await mkProduct({ price: 1200, stock: 4 });
      const { body, status } = await order(agent, [{ productId: String(p._id), qty: 1 }], { paymentMethod: 'razorpay' });
      assert.equal(status, 201);
      assert.equal(body.order.status, 'pending_payment');
      assert.equal(body.payment.amount, 120000);
      const rzpId = body.order.razorpayOrderId;

      const forged = await agent.post(`/api/orders/${body.order.id}/verify`).send({
        razorpay_order_id: rzpId, razorpay_payment_id: 'pay_1', razorpay_signature: 'f'.repeat(64),
      });
      assert.equal(forged.status, 400);
      assert.equal((await Order.findById(body.order.id)).paymentStatus, 'pending');

      const good = { razorpay_order_id: rzpId, razorpay_payment_id: 'pay_1', razorpay_signature: sign(rzpId, 'pay_1') };
      const ok = await agent.post(`/api/orders/${body.order.id}/verify`).send(good);
      assert.equal(ok.status, 200);
      assert.equal(ok.body.order.status, 'placed');
      assert.equal(ok.body.order.paymentStatus, 'paid');
      assert.equal((await agent.post(`/api/orders/${body.order.id}/verify`).send(good)).status, 200);

      const paidCancel = await agent.post(`/api/orders/${body.order.id}/cancel`);
      assert.equal(paidCancel.status, 200);
      assert.equal(paidCancel.body.refund, 'refunded');
      assert.equal(paidCancel.body.order.paymentStatus, 'refunded');
      assert.equal((await Product.findById(p._id)).stock, 4); // stock returned
    } finally {
      restore();
    }
  });

  test('rejects a valid signature that belongs to a different order', async () => {
    const restore = stub();
    try {
      const agent = await signedIn();
      const p = await mkProduct({ stock: 9 });
      const items = [{ productId: String(p._id), qty: 1 }];
      const a = (await order(agent, items, { paymentMethod: 'razorpay' })).body.order;
      const b = (await order(agent, items, { paymentMethod: 'razorpay' })).body.order;
      const res = await agent.post(`/api/orders/${a.id}/verify`).send({
        razorpay_order_id: b.razorpayOrderId, razorpay_payment_id: 'pay_x', razorpay_signature: sign(b.razorpayOrderId, 'pay_x'),
      });
      assert.equal(res.status, 400);
    } finally {
      restore();
    }
  });

  test('payment gateway failure rolls back stock and the order', async () => {
    const orig = razorpay.createOrder;
    razorpay.createOrder = async () => { throw new Error('gateway down'); };
    try {
      const agent = await signedIn();
      const p = await mkProduct({ stock: 4 });
      const res = await order(agent, [{ productId: String(p._id), qty: 2 }], { paymentMethod: 'razorpay' });
      assert.equal(res.status, 502);
      assert.equal((await Product.findById(p._id)).stock, 4);
      assert.equal(await Order.countDocuments(), 0);
    } finally {
      razorpay.createOrder = orig;
    }
  });

  test('unpaid orders expire and release stock; late verification is refused', async () => {
    const restore = stub();
    try {
      const agent = await signedIn();
      const p = await mkProduct({ stock: 4 });
      const { body } = await order(agent, [{ productId: String(p._id), qty: 3 }], { paymentMethod: 'razorpay' });
      assert.equal((await Product.findById(p._id)).stock, 1);
      assert.equal(await expireUnpaidOrders(Date.now()), 0); // still fresh
      assert.equal(await expireUnpaidOrders(Date.now() + 31 * 60 * 1000), 1);
      assert.equal((await Product.findById(p._id)).stock, 4);
      assert.equal(await expireUnpaidOrders(Date.now() + 60 * 60 * 1000), 0); // no double restock

      const rzpId = body.order.razorpayOrderId;
      const late = await agent.post(`/api/orders/${body.order.id}/verify`).send({
        razorpay_order_id: rzpId, razorpay_payment_id: 'pay_9', razorpay_signature: sign(rzpId, 'pay_9'),
      });
      assert.equal(late.status, 409);
    } finally {
      restore();
    }
  });
});

describe('admin', () => {
  test('blocks anonymous and customer access', async () => {
    assert.equal((await request(app).get('/api/admin/stats')).status, 401);
    const customer = await signedIn();
    assert.equal((await customer.get('/api/admin/stats')).status, 403);
    assert.equal((await customer.post('/api/admin/products').send({})).status, 403);
  });

  test('product CRUD with unique slugs and validation', async () => {
    const admin = await adminAgent();
    const body = { title: 'New Racket', brand: 'Kestrel', category: 'Badminton', price: 2000, mrp: 2500, stock: 5, images: ['https://example.com/a.jpg'] };
    const a = await admin.post('/api/admin/products').send(body);
    assert.equal(a.status, 201);
    assert.equal(a.body.product.slug, 'new-racket');
    assert.equal((await admin.get(`/api/admin/products/${a.body.product.id}`)).body.product.title, 'New Racket');
    const b = await admin.post('/api/admin/products').send(body);
    assert.notEqual(b.body.product.slug, 'new-racket');

    assert.equal((await admin.post('/api/admin/products').send({ ...body, mrp: 100 })).status, 400);
    assert.equal((await admin.post('/api/admin/products').send({ ...body, images: ['javascript:alert(1)'] })).status, 400);

    const upd = await admin.put(`/api/admin/products/${a.body.product.id}`).send({ ...body, price: 1800, active: false });
    assert.equal(upd.body.product.price, 1800);
    assert.equal((await request(app).get('/api/products')).body.total, 1); // inactive one hidden
    assert.equal((await admin.delete(`/api/admin/products/${a.body.product.id}`)).status, 200);
  });

  test('order lifecycle: valid transitions only, COD paid on delivery, cancel restocks', async () => {
    const customer = await signedIn();
    const admin = await adminAgent();
    const p = await mkProduct({ stock: 5, price: 1500 });
    const o = (await order(customer, [{ productId: String(p._id), qty: 2 }])).body.order;

    const skip = await admin.patch(`/api/admin/orders/${o.id}`).send({ status: 'delivered' });
    assert.equal(skip.status, 400);
    for (const status of ['packed', 'shipped', 'delivered']) {
      assert.equal((await admin.patch(`/api/admin/orders/${o.id}`).send({ status })).status, 200);
    }
    const done = await Order.findById(o.id);
    assert.equal(done.paymentStatus, 'paid');
    assert.equal((await admin.patch(`/api/admin/orders/${o.id}`).send({ status: 'cancelled' })).status, 400);

    const o2 = (await order(customer, [{ productId: String(p._id), qty: 1 }])).body.order;
    assert.equal((await Product.findById(p._id)).stock, 2);
    await admin.patch(`/api/admin/orders/${o2.id}`).send({ status: 'cancelled' });
    assert.equal((await Product.findById(p._id)).stock, 3);
  });

  test('dashboard stats', async () => {
    const customer = await signedIn();
    const admin = await adminAgent();
    const p = await mkProduct({ stock: 4, price: 2000 });
    await order(customer, [{ productId: String(p._id), qty: 1 }]);
    const s = (await admin.get('/api/admin/stats')).body;
    assert.equal(s.last7Days.orders, 1);
    assert.equal(s.last7Days.revenue, 2000);
    assert.equal(s.customers, 1);
    assert.equal(s.lowStock.length, 1);
    const list = (await admin.get('/api/admin/orders?status=placed')).body;
    assert.equal(list.total, 1);
    assert.equal(list.items[0].user.email, 'riya@example.com');
  });
});
