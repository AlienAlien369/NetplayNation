const { test, describe } = require('node:test');
const { app, request, assert, crypto, Product, Order, razorpay, mail, useDb, signedIn, adminAgent, mkProduct, order, line, stubRazorpay, rzpSign } = require('./helpers');
const { expireUnpaidOrders } = require('../lib/orders');

useDb();

const webhookBody = (orderId, paymentId, amountPaise, event = 'payment.captured') =>
  JSON.stringify({ event, payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: amountPaise, status: 'captured' } } } });
const sign = (raw) => crypto.createHmac('sha256', 'whsec_test').update(raw).digest('hex');
const post = (raw, signature = sign(raw)) =>
  request(app).post('/api/webhooks/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', signature).send(raw);

async function pendingOnlineOrder(agent, p, qty = 1) {
  const res = await order(agent, [line(p, qty)], { paymentMethod: 'razorpay' });
  assert.equal(res.status, 201);
  return res.body.order;
}

describe('refunds', () => {
  test('customer cancelling a paid order refunds it in full and restocks', async () => {
    const restore = stubRazorpay();
    try {
      const agent = await signedIn();
      const p = await mkProduct({ stock: 5, price: 1200 });
      const o = await pendingOnlineOrder(agent, p, 2);
      await agent.post(`/api/orders/${o.id}/verify`).send({ razorpay_order_id: o.razorpayOrderId, razorpay_payment_id: 'pay_1', razorpay_signature: rzpSign(o.razorpayOrderId, 'pay_1') });
      mail.outbox.length = 0;

      const res = await agent.post(`/api/orders/${o.id}/cancel`);
      assert.equal(res.body.refund, 'refunded');
      assert.equal(res.body.order.paymentStatus, 'refunded');
      assert.ok(res.body.order.refundId);
      assert.equal((await Product.findById(p._id)).stock, 5);
      assert.match(mail.outbox[0].text, /refund/i);
    } finally {
      restore();
    }
  });

  test('refund is issued exactly once even under concurrent cancels', async () => {
    let calls = 0;
    const restore = stubRazorpay({ refund: async () => { calls += 1; await new Promise((r) => setTimeout(r, 30)); return { id: 'rfnd_1' }; } });
    try {
      const agent = await signedIn();
      const admin = await adminAgent();
      const p = await mkProduct({ stock: 5 });
      const o = await pendingOnlineOrder(agent, p);
      await agent.post(`/api/orders/${o.id}/verify`).send({ razorpay_order_id: o.razorpayOrderId, razorpay_payment_id: 'pay_1', razorpay_signature: rzpSign(o.razorpayOrderId, 'pay_1') });
      await Promise.all([agent.post(`/api/orders/${o.id}/cancel`), admin.patch(`/api/admin/orders/${o.id}`).send({ status: 'cancelled' })]);
      assert.equal(calls, 1);
      assert.equal((await Product.findById(p._id)).stock, 5); // restocked once
    } finally {
      restore();
    }
  });

  test('a failed refund is flagged and an admin can retry it', async () => {
    const restore = stubRazorpay({ refund: async () => { throw new Error('gateway down'); } });
    try {
      const agent = await signedIn();
      const admin = await adminAgent();
      const p = await mkProduct();
      const o = await pendingOnlineOrder(agent, p);
      await agent.post(`/api/orders/${o.id}/verify`).send({ razorpay_order_id: o.razorpayOrderId, razorpay_payment_id: 'pay_1', razorpay_signature: rzpSign(o.razorpayOrderId, 'pay_1') });
      const res = await admin.patch(`/api/admin/orders/${o.id}`).send({ status: 'cancelled' });
      assert.equal(res.body.refund, 'failed');
      assert.equal(res.body.order.status, 'cancelled');
      assert.equal(res.body.order.refundFailed, true);
      assert.equal(res.body.order.paymentStatus, 'paid');

      razorpay.refund = async () => ({ id: 'rfnd_ok' });
      const retry = await admin.post(`/api/admin/orders/${o.id}/refund`);
      assert.equal(retry.body.refund, 'refunded');
      assert.equal(retry.body.order.paymentStatus, 'refunded');
      assert.equal(retry.body.order.refundFailed, false);
      assert.equal((await admin.post(`/api/admin/orders/${o.id}/refund`)).status, 400); // nothing left to refund
    } finally {
      restore();
    }
  });

  test('COD orders cancel without any refund call', async () => {
    let calls = 0;
    const restore = stubRazorpay({ refund: async () => { calls += 1; return { id: 'x' }; } });
    try {
      const agent = await signedIn();
      const p = await mkProduct();
      const o = (await order(agent, [line(p)])).body.order;
      const res = await agent.post(`/api/orders/${o.id}/cancel`);
      assert.equal(res.body.refund, 'none');
      assert.equal(calls, 0);
    } finally {
      restore();
    }
  });

  test('paying after the order expired refunds automatically', async () => {
    const restore = stubRazorpay();
    try {
      const agent = await signedIn();
      const p = await mkProduct({ stock: 4 });
      const o = await pendingOnlineOrder(agent, p);
      await expireUnpaidOrders(Date.now() + 31 * 60 * 1000);
      const late = await agent.post(`/api/orders/${o.id}/verify`).send({ razorpay_order_id: o.razorpayOrderId, razorpay_payment_id: 'pay_9', razorpay_signature: rzpSign(o.razorpayOrderId, 'pay_9') });
      assert.equal(late.status, 409);
      assert.match(late.body.error, /refunded/);
      const stored = await Order.findById(o.id);
      assert.equal(stored.paymentStatus, 'refunded');
      assert.equal(stored.status, 'cancelled');
    } finally {
      restore();
    }
  });
});

describe('razorpay webhook', () => {
  test('rejects bad signatures and unsigned requests', async () => {
    const raw = webhookBody('order_x', 'pay_1', 100);
    assert.equal((await post(raw, 'f'.repeat(64))).status, 400);
    assert.equal((await post(raw, '')).status, 400);
  });

  test('confirms an order whose customer never returned to the site, and is idempotent', async () => {
    const restore = stubRazorpay();
    try {
      const agent = await signedIn();
      const p = await mkProduct({ price: 1500, stock: 3 });
      const o = await pendingOnlineOrder(agent, p);
      mail.outbox.length = 0;

      const raw = webhookBody(o.razorpayOrderId, 'pay_77', o.total * 100);
      assert.equal((await post(raw)).status, 200);
      const stored = await Order.findById(o.id);
      assert.equal(stored.status, 'placed');
      assert.equal(stored.paymentStatus, 'paid');
      assert.equal(stored.razorpayPaymentId, 'pay_77');
      assert.equal(mail.outbox.length, 1);

      assert.equal((await post(raw)).status, 200); // Razorpay retries: no second email or change
      assert.equal(mail.outbox.length, 1);
    } finally {
      restore();
    }
  });

  test('ignores a payment whose amount does not match the order', async () => {
    const restore = stubRazorpay();
    try {
      const agent = await signedIn();
      const p = await mkProduct({ price: 1500 });
      const o = await pendingOnlineOrder(agent, p);
      await post(webhookBody(o.razorpayOrderId, 'pay_low', 100));
      assert.equal((await Order.findById(o.id)).paymentStatus, 'pending');
    } finally {
      restore();
    }
  });

  test('a payment for an already-expired order is refunded', async () => {
    const restore = stubRazorpay();
    try {
      const agent = await signedIn();
      const p = await mkProduct({ stock: 4 });
      const o = await pendingOnlineOrder(agent, p);
      await expireUnpaidOrders(Date.now() + 31 * 60 * 1000);
      await post(webhookBody(o.razorpayOrderId, 'pay_late', o.total * 100));
      const stored = await Order.findById(o.id);
      assert.equal(stored.status, 'cancelled');
      assert.equal(stored.paymentStatus, 'refunded');
    } finally {
      restore();
    }
  });

  test('ignores unrelated events', async () => {
    const res = await post(JSON.stringify({ event: 'refund.processed', payload: {} }));
    assert.equal(res.status, 200);
    assert.equal(res.body.ignored, true);
  });
});
