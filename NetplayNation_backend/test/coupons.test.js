const { test, describe } = require('node:test');
const { app, request, assert, Product, Order, mail, useDb, signedIn, adminAgent, mkProduct, order, line, stubRazorpay } = require('./helpers');
const Coupon = require('../models/Coupon');

useDb([Coupon]);

const mk = (over = {}) => Coupon.create({ code: 'SAVE10', type: 'percent', value: 10, ...over });
const quote = (agent, items, coupon) => agent.post('/api/cart/quote').send({ items, coupon });

describe('coupon pricing', () => {
  test('percent coupon reduces the total; shipping threshold uses the pre-discount subtotal', async () => {
    await mk({ maxDiscount: 500 });
    const p = await mkProduct({ price: 1000 });
    const agent = await signedIn();
    const q = (await quote(agent, [line(p, 1)], 'save10')).body; // case-insensitive
    assert.equal(q.couponCode, 'SAVE10');
    assert.equal(q.discount, 100);
    assert.equal(q.shipping, 0); // 1000 >= 999 even though the discounted subtotal is 900
    assert.equal(q.total, 900);
    assert.equal(q.couponError, null);
  });

  test('maxDiscount caps percent coupons; flat coupons never make an order free', async () => {
    await mk({ code: 'BIG', value: 50, maxDiscount: 300 });
    await mk({ code: 'HUGE', type: 'flat', value: 5000 });
    const p = await mkProduct({ price: 1000 });
    assert.equal((await quote(request(app), [line(p, 2)], 'BIG')).body.discount, 300);
    const huge = (await quote(request(app), [line(p, 1)], 'HUGE')).body;
    assert.equal(huge.discount, 999);
    assert.ok(huge.total >= 1);
  });

  test('invalid, expired, inactive, under-minimum and exhausted coupons explain why', async () => {
    const p = await mkProduct({ price: 500 });
    const cart = [line(p)];
    const reason = async (code) => (await quote(request(app), cart, code)).body.couponError;
    assert.match(await reason('NOPE'), /not valid/);
    await mk({ code: 'OLD', expiresAt: new Date(Date.now() - 1000) });
    assert.match(await reason('OLD'), /expired/);
    await mk({ code: 'OFF', active: false });
    assert.match(await reason('OFF'), /not valid/);
    await mk({ code: 'MIN', minSubtotal: 2000 });
    assert.match(await reason('MIN'), /1,500 more/);
    await mk({ code: 'GONE', usageLimit: 1, usedCount: 1 });
    assert.match(await reason('GONE'), /fully redeemed/);
  });
});

describe('coupon redemption', () => {
  test('order stores the discount, counts a redemption, and cancelling gives it back', async () => {
    await mk({ usageLimit: 5 });
    const agent = await signedIn();
    const p = await mkProduct({ price: 2000 });
    const res = await order(agent, [line(p)], { couponCode: 'SAVE10' });
    assert.equal(res.status, 201);
    assert.equal(res.body.order.discount, 200);
    assert.equal(res.body.order.total, 1800);
    assert.equal(res.body.order.couponCode, 'SAVE10');
    assert.equal((await Coupon.findOne({ code: 'SAVE10' })).usedCount, 1);
    assert.match(mail.outbox[0].text, /1,800/);

    await agent.post(`/api/orders/${res.body.order.id}/cancel`);
    assert.equal((await Coupon.findOne({ code: 'SAVE10' })).usedCount, 0);
    await agent.post(`/api/orders/${res.body.order.id}/cancel`);
    assert.equal((await Coupon.findOne({ code: 'SAVE10' })).usedCount, 0); // never below zero
  });

  test('a customer can use a one-per-customer coupon only once, unless the order was cancelled', async () => {
    await mk();
    const agent = await signedIn();
    const p = await mkProduct({ price: 2000, stock: 9 });
    const first = await order(agent, [line(p)], { couponCode: 'SAVE10' });
    assert.equal(first.status, 201);
    const second = await order(agent, [line(p)], { couponCode: 'SAVE10' });
    assert.equal(second.status, 400);
    assert.match(second.body.error, /already used/);
    assert.equal((await Product.findById(p._id)).stock, 8); // failed order did not hold stock

    await agent.post(`/api/orders/${first.body.order.id}/cancel`);
    assert.equal((await order(agent, [line(p)], { couponCode: 'SAVE10' })).status, 201);
  });

  test('a limited coupon cannot be over-redeemed by concurrent checkouts', async () => {
    await mk({ usageLimit: 2, perUserLimit: 5 });
    const p = await mkProduct({ price: 2000, stock: 20 });
    const agents = await Promise.all([1, 2, 3, 4, 5].map((i) => signedIn(`u${i}@example.com`)));
    const results = await Promise.all(agents.map((a) => order(a, [line(p)], { couponCode: 'SAVE10' })));
    assert.equal(results.filter((r) => r.status === 201).length, 2);
    assert.equal((await Coupon.findOne({ code: 'SAVE10' })).usedCount, 2);
    assert.equal((await Product.findById(p._id)).stock, 18); // losers released their stock
  });

  test('an invalid code blocks the order without side effects; the discount is computed on the server', async () => {
    await mk();
    const agent = await signedIn();
    const p = await mkProduct({ price: 2000, stock: 5 });
    const bad = await order(agent, [line(p)], { couponCode: 'FAKE' });
    assert.equal(bad.status, 400);
    assert.equal((await Product.findById(p._id)).stock, 5);
    assert.equal(await Order.countDocuments(), 0);
    const tampered = await agent.post('/api/orders').send({ items: [line(p)], address: require('./helpers').address, paymentMethod: 'cod', couponCode: 'SAVE10', discount: 99999, total: 1 });
    assert.equal(tampered.body.order.total, 1800);
  });

  test('a failed payment start gives the coupon redemption back', async () => {
    await mk({ usageLimit: 1 });
    const restore = stubRazorpay({ createOrder: async () => { throw new Error('gateway down'); } });
    try {
      const agent = await signedIn();
      const p = await mkProduct({ price: 2000 });
      const res = await order(agent, [line(p)], { couponCode: 'SAVE10', paymentMethod: 'razorpay' });
      assert.equal(res.status, 502);
      assert.equal((await Coupon.findOne({ code: 'SAVE10' })).usedCount, 0);
    } finally {
      restore();
    }
  });

  test('online payments charge the discounted amount', async () => {
    await mk();
    const restore = stubRazorpay();
    try {
      const agent = await signedIn();
      const p = await mkProduct({ price: 2000 });
      const res = await order(agent, [line(p)], { couponCode: 'SAVE10', paymentMethod: 'razorpay' });
      assert.equal(res.body.payment.amount, 180000);
    } finally {
      restore();
    }
  });
});

describe('admin coupons', () => {
  test('customers cannot manage coupons', async () => {
    const customer = await signedIn();
    assert.equal((await customer.get('/api/admin/coupons')).status, 403);
    assert.equal((await customer.post('/api/admin/coupons').send({ code: 'X1X1', type: 'flat', value: 5 })).status, 403);
  });

  test('create, validate, update and delete', async () => {
    const admin = await adminAgent();
    const created = await admin.post('/api/admin/coupons').send({ code: 'welcome10', type: 'percent', value: 10, minSubtotal: 500, expiresAt: '2030-12-31', usageLimit: 100 });
    assert.equal(created.status, 201);
    assert.equal(created.body.coupon.code, 'WELCOME10');
    assert.equal(new Date(created.body.coupon.expiresAt).getUTCFullYear(), 2030);
    assert.equal((await admin.post('/api/admin/coupons').send({ code: 'WELCOME10', type: 'flat', value: 5 })).status, 409);
    assert.equal((await admin.post('/api/admin/coupons').send({ code: 'BAD', type: 'percent', value: 150 })).status, 400);
    assert.equal((await admin.post('/api/admin/coupons').send({ code: 'a b', type: 'flat', value: 5 })).status, 400);

    const id = created.body.coupon.id;
    const upd = await admin.put(`/api/admin/coupons/${id}`).send({ code: 'WELCOME10', type: 'flat', value: 100, active: false });
    assert.equal(upd.body.coupon.type, 'flat');
    assert.equal(upd.body.coupon.usageLimit, undefined); // cleared limits are removed
    assert.equal(upd.body.coupon.active, false);
    assert.equal((await admin.get('/api/admin/coupons')).body.items.length, 1);
    assert.equal((await admin.delete(`/api/admin/coupons/${id}`)).status, 200);
  });
});
