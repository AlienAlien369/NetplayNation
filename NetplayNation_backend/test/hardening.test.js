const { test, describe } = require('node:test');
const { app, request, assert, Product, Order, User, mail, useDb, signedIn, adminAgent, mkProduct, order, line, stubRazorpay, rzpSign } = require('./helpers');
const Coupon = require('../models/Coupon');

useDb([Coupon]);

const verifyBody = (o, pay = 'pay_1') => ({ razorpay_order_id: o.razorpayOrderId, razorpay_payment_id: pay, razorpay_signature: rzpSign(o.razorpayOrderId, pay) });
const onlineOrder = async (agent, p, qty = 1, extra = {}) => (await order(agent, [line(p, qty)], { paymentMethod: 'razorpay', ...extra })).body.order;

describe('payment races keep stock, status and money consistent', () => {
  test('verify racing with cancel never leaves a paid order restocked and placed', async () => {
    const restore = stubRazorpay();
    try {
      for (let i = 0; i < 8; i += 1) {
        await Promise.all([Order.deleteMany({}), User.deleteMany({}), Product.deleteMany({})]);
        const agent = await signedIn();
        const p = await mkProduct({ stock: 5 });
        const o = await onlineOrder(agent, p, 2);
        await Promise.all([agent.post(`/api/orders/${o.id}/verify`).send(verifyBody(o)), agent.post(`/api/orders/${o.id}/cancel`)]);
        const stored = await Order.findById(o.id);
        const stock = (await Product.findById(p._id)).stock;
        if (stored.status === 'placed') {
          assert.equal(stored.paymentStatus, 'paid');
          assert.equal(stock, 3, 'placed order must keep its stock reserved');
        } else {
          assert.equal(stored.status, 'cancelled');
          assert.equal(stock, 5, 'cancelled order must return its stock');
          assert.ok(['pending', 'refunded'].includes(stored.paymentStatus), `cancelled order must not stay paid (was ${stored.paymentStatus})`);
        }
      }
    } finally {
      restore();
    }
  });

  test('a webhook and a browser verify for the same payment place the order once', async () => {
    const restore = stubRazorpay();
    try {
      const agent = await signedIn();
      const p = await mkProduct({ stock: 3 });
      const o = await onlineOrder(agent, p);
      mail.outbox.length = 0;
      const crypto = require('crypto');
      const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: o.razorpayOrderId, amount: o.total * 100 } } } });
      const sig = crypto.createHmac('sha256', 'whsec_test').update(raw).digest('hex');
      await Promise.all([
        agent.post(`/api/orders/${o.id}/verify`).send(verifyBody(o)),
        request(app).post('/api/webhooks/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', sig).send(raw),
      ]);
      const stored = await Order.findById(o.id);
      assert.equal(stored.status, 'placed');
      assert.equal(stored.paymentStatus, 'paid');
      assert.equal(mail.outbox.filter((m) => /confirmed/.test(m.subject)).length, 1);
      assert.equal((await Product.findById(p._id)).stock, 2);
    } finally {
      restore();
    }
  });

  test('replaying verify after a refund does not resurrect the payment', async () => {
    const restore = stubRazorpay();
    try {
      const agent = await signedIn();
      const p = await mkProduct({ stock: 3 });
      const o = await onlineOrder(agent, p);
      await agent.post(`/api/orders/${o.id}/verify`).send(verifyBody(o));
      await agent.post(`/api/orders/${o.id}/cancel`);
      const replay = await agent.post(`/api/orders/${o.id}/verify`).send(verifyBody(o));
      assert.equal(replay.status, 200);
      const stored = await Order.findById(o.id);
      assert.equal(stored.status, 'cancelled');
      assert.equal(stored.paymentStatus, 'refunded');
      assert.equal(stored.refundFailed, false);
    } finally {
      restore();
    }
  });
});

describe('cancellation and admin transitions cannot conflict', () => {
  test('a customer cancel racing an admin ship never refunds a shipped order', async () => {
    const restore = stubRazorpay();
    try {
      const admin = await adminAgent();
      for (let i = 0; i < 8; i += 1) {
        await Promise.all([Order.deleteMany({}), Product.deleteMany({}), User.deleteMany({ role: 'customer' })]);
        const agent = await signedIn();
        const p = await mkProduct({ stock: 5 });
        const o = await onlineOrder(agent, p);
        await agent.post(`/api/orders/${o.id}/verify`).send(verifyBody(o));
        await admin.patch(`/api/admin/orders/${o.id}`).send({ status: 'packed' });
        await Promise.all([agent.post(`/api/orders/${o.id}/cancel`), admin.patch(`/api/admin/orders/${o.id}`).send({ status: 'shipped' })]);
        const stored = await Order.findById(o.id);
        const stock = (await Product.findById(p._id)).stock;
        if (stored.status === 'shipped') {
          assert.equal(stored.paymentStatus, 'paid', 'shipped order must not be refunded');
          assert.equal(stock, 4);
        } else {
          assert.equal(stored.status, 'cancelled');
          assert.equal(stored.paymentStatus, 'refunded');
          assert.equal(stock, 5);
        }
      }
    } finally {
      restore();
    }
  });

  test('customers cannot cancel once an order is packed or shipped', async () => {
    const agent = await signedIn();
    const admin = await adminAgent();
    const p = await mkProduct({ stock: 5 });
    const o = (await order(agent, [line(p)])).body.order;
    await admin.patch(`/api/admin/orders/${o.id}`).send({ status: 'packed' });
    assert.equal((await agent.post(`/api/orders/${o.id}/cancel`)).status, 400);
    assert.equal((await Order.findById(o.id)).status, 'packed');
  });

  test('two admins changing one order at once: the second gets a conflict, not a silent overwrite', async () => {
    const agent = await signedIn();
    const admin = await adminAgent();
    const p = await mkProduct({ stock: 5 });
    const o = (await order(agent, [line(p)])).body.order;
    const results = await Promise.all([
      admin.patch(`/api/admin/orders/${o.id}`).send({ status: 'packed' }),
      admin.patch(`/api/admin/orders/${o.id}`).send({ status: 'cancelled' }),
    ]);
    const stored = await Order.findById(o.id);
    const stock = (await Product.findById(p._id)).stock;
    assert.ok(results.some((r) => r.status === 200));
    if (stored.status === 'cancelled') assert.equal(stock, 5);
    else { assert.equal(stored.status, 'packed'); assert.equal(stock, 4); }
  });
});

describe('abuse limits', () => {
  test('a per-customer coupon limit holds under simultaneous orders', async () => {
    await Coupon.create({ code: 'ONCE', type: 'percent', value: 10, perUserLimit: 1 });
    const agent = await signedIn();
    const p = await mkProduct({ price: 2000, stock: 20 });
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => order(agent, [line(p)], { couponCode: 'ONCE' })));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(await Order.countDocuments(), 1);
    assert.equal((await Coupon.findOne({ code: 'ONCE' })).usedCount, 1);
    assert.equal((await Product.findById(p._id)).stock, 19);
  });

  test('a coupon redemption is released by id even if the code is later recreated', async () => {
    await Coupon.create({ code: 'PROMO', type: 'flat', value: 100 });
    const agent = await signedIn();
    const p = await mkProduct({ price: 2000 });
    const o = (await order(agent, [line(p)], { couponCode: 'PROMO' })).body.order;
    const admin = await adminAgent();
    const old = await Coupon.findOne({ code: 'PROMO' });
    await admin.delete(`/api/admin/coupons/${old.id}`);
    const fresh = await Coupon.create({ code: 'PROMO', type: 'flat', value: 50, usedCount: 3 });
    await agent.post(`/api/orders/${o.id}/cancel`);
    assert.equal((await Coupon.findById(fresh._id)).usedCount, 3); // the new coupon is untouched
  });

  test('a customer cannot hold stock with unlimited unpaid online orders', async () => {
    const restore = stubRazorpay();
    try {
      const agent = await signedIn();
      const p = await mkProduct({ stock: 50 });
      for (let i = 0; i < 3; i += 1) assert.equal((await order(agent, [line(p)], { paymentMethod: 'razorpay' })).status, 201);
      const fourth = await order(agent, [line(p)], { paymentMethod: 'razorpay' });
      assert.equal(fourth.status, 429);
      assert.equal((await Product.findById(p._id)).stock, 47);
      assert.equal((await order(agent, [line(p)])).status, 201); // COD is unaffected
    } finally {
      restore();
    }
  });

  test('editing a product with a stale form keeps stock from orders placed in between', async () => {
    const admin = await adminAgent();
    const customer = await signedIn();
    const p = await mkProduct({ stock: 10, price: 1000 });
    const body = { title: p.title, brand: p.brand, category: p.category, price: 1000, images: [] };
    await order(customer, [line(p, 3)]); // stock is now 7 while the admin's form still shows 10
    const res = await admin.put(`/api/admin/products/${p.id}`).send({ ...body, stock: 12, loadedStock: 10 });
    assert.equal(res.body.product.stock, 9); // +2 from the admin's change, not overwritten to 12
    const plain = await admin.put(`/api/admin/products/${p.id}`).send({ ...body, stock: 4 });
    assert.equal(plain.body.product.stock, 4); // without loadedStock the value is set directly
  });

  test('password reset requests are throttled per address without revealing anything', async () => {
    await signedIn('riya@example.com');
    mail.outbox.length = 0;
    await request(app).post('/api/auth/forgot').send({ email: 'riya@example.com' });
    const first = mail.outbox[0].text.match(/token=([a-f0-9]+)/)[1];
    const again = await request(app).post('/api/auth/forgot').send({ email: 'riya@example.com' });
    assert.equal(again.status, 200);
    assert.equal(mail.outbox.length, 1); // no second email, no flooding
    const reset = await request(app).post('/api/auth/reset').send({ token: first, password: 'brandNewPass1' });
    assert.equal(reset.status, 200); // the original link still works
  });
});
