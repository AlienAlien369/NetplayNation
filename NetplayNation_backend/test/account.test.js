const { test, describe } = require('node:test');
const { app, request, assert, User, mail, useDb, signedIn, adminAgent, mkProduct, order, line } = require('./helpers');

useDb();

const tokenFrom = (msg) => msg.text.match(/token=([a-f0-9]+)/)[1];

describe('password reset', () => {
  test('unknown email gets the same answer and no email', async () => {
    const res = await request(app).post('/api/auth/forgot').send({ email: 'nobody@example.com' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(mail.outbox.length, 0);
  });

  test('emails a single-use link that sets a new password and signs in', async () => {
    await signedIn('riya@example.com');
    await request(app).post('/api/auth/forgot').send({ email: 'riya@example.com' });
    assert.equal(mail.outbox.length, 1);
    assert.match(mail.outbox[0].text, /reset-password\?token=/);
    const token = tokenFrom(mail.outbox[0]);

    const stored = await User.findOne({ email: 'riya@example.com' }).select('+resetTokenHash');
    assert.notEqual(stored.resetTokenHash, token); // only a hash is stored

    const weak = await request(app).post('/api/auth/reset').send({ token, password: 'short' });
    assert.equal(weak.status, 400);

    const agent = request.agent(app);
    const ok = await agent.post('/api/auth/reset').send({ token, password: 'brandNewPass1' });
    assert.equal(ok.status, 200);
    assert.equal((await agent.get('/api/auth/me')).body.user.email, 'riya@example.com');
    assert.equal((await request(app).post('/api/auth/login').send({ email: 'riya@example.com', password: 'brandNewPass1' })).status, 200);
    assert.equal((await request(app).post('/api/auth/login').send({ email: 'riya@example.com', password: 'password123' })).status, 401);

    const reuse = await request(app).post('/api/auth/reset').send({ token, password: 'anotherPass99' });
    assert.equal(reuse.status, 400);
  });

  test('expired and garbage tokens are rejected', async () => {
    await signedIn('riya@example.com');
    await request(app).post('/api/auth/forgot').send({ email: 'riya@example.com' });
    const token = tokenFrom(mail.outbox[0]);
    await User.updateOne({ email: 'riya@example.com' }, { resetExpires: new Date(Date.now() - 1000) });
    assert.equal((await request(app).post('/api/auth/reset').send({ token, password: 'brandNewPass1' })).status, 400);
    assert.equal((await request(app).post('/api/auth/reset').send({ token: 'x'.repeat(64), password: 'brandNewPass1' })).status, 400);
  });

  test('a reset signs out sessions that existed before it', async () => {
    const oldSession = await signedIn('riya@example.com');
    assert.ok((await oldSession.get('/api/auth/me')).body.user);
    await new Promise((r) => setTimeout(r, 1100)); // JWT timestamps have one-second resolution
    await request(app).post('/api/auth/forgot').send({ email: 'riya@example.com' });
    await request(app).post('/api/auth/reset').send({ token: tokenFrom(mail.outbox[0]), password: 'brandNewPass1' });
    assert.equal((await oldSession.get('/api/auth/me')).body.user, null);
  });
});

describe('order emails', () => {
  test('COD order sends a confirmation with items, total and a tracking link', async () => {
    const agent = await signedIn('riya@example.com', 'Riya Sharma');
    const p = await mkProduct({ title: 'Aero <b>Pro</b>', price: 1500 });
    const res = await order(agent, [line(p, 2)]);
    assert.equal(mail.outbox.length, 1);
    const m = mail.outbox[0];
    assert.equal(m.to, 'riya@example.com');
    assert.match(m.subject, /confirmed/);
    assert.match(m.text, /3,000/);
    assert.ok(m.text.includes(`/orders/${res.body.order.id}`));
    assert.ok(!m.html.includes('<b>Pro</b>')); // customer-supplied text is escaped
    assert.ok(m.html.includes('&lt;b&gt;Pro&lt;/b&gt;'));
  });

  test('admin shipping and cancelling send emails', async () => {
    const customer = await signedIn('riya@example.com');
    const admin = await adminAgent();
    const p = await mkProduct();
    const o = (await order(customer, [line(p)])).body.order;
    mail.outbox.length = 0;
    await admin.patch(`/api/admin/orders/${o.id}`).send({ status: 'packed' });
    assert.equal(mail.outbox.length, 0);
    await admin.patch(`/api/admin/orders/${o.id}`).send({ status: 'shipped' });
    assert.match(mail.outbox[0].subject, /shipped/);

    const o2 = (await order(customer, [line(p)])).body.order;
    mail.outbox.length = 0;
    await admin.patch(`/api/admin/orders/${o2.id}`).send({ status: 'cancelled' });
    assert.match(mail.outbox[0].subject, /cancelled/);
  });
});
