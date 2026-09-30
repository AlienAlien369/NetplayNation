const { test, describe } = require('node:test');
const { app, request, assert, Product, useDb, signedIn, adminAgent, mkProduct, order, line } = require('./helpers');
const Review = require('../models/Review');

useDb([Review]);

async function deliveredTo(agent, admin, product) {
  const o = (await order(agent, [line(product)])).body.order;
  for (const status of ['packed', 'shipped', 'delivered']) await admin.patch(`/api/admin/orders/${o.id}`).send({ status });
  return o;
}
const review = (agent, product, body) => agent.post(`/api/products/${product.slug}/reviews`).send(body);

describe('reviews', () => {
  test('only customers who received the product can review it', async () => {
    const p = await mkProduct();
    const anon = await review(request(app), p, { rating: 5 });
    assert.equal(anon.status, 401);

    const agent = await signedIn('riya@example.com', 'Riya Sharma');
    const notBought = await review(agent, p, { rating: 5, body: 'Great' });
    assert.equal(notBought.status, 403);

    const admin = await adminAgent();
    await order(agent, [line(p)]); // placed, not delivered yet
    assert.equal((await review(agent, p, { rating: 5 })).status, 403);
    const status = await agent.get(`/api/products/${p.slug}/reviews`);
    assert.equal(status.body.me.canReview, false);

    await deliveredTo(agent, admin, p);
    assert.equal((await agent.get(`/api/products/${p.slug}/reviews`)).body.me.canReview, true);
    assert.equal((await review(agent, p, { rating: 4, title: 'Solid', body: 'Feels great' })).status, 201);
  });

  test('ratings are averaged on the product, one review per customer (edits replace)', async () => {
    const p = await mkProduct();
    const admin = await adminAgent();
    const a = await signedIn('a@example.com', 'Aarav Mehta');
    const b = await signedIn('b@example.com', 'Bhavna Rao');
    await deliveredTo(a, admin, p);
    await deliveredTo(b, admin, p);

    await review(a, p, { rating: 5, body: 'Loved it' });
    await review(b, p, { rating: 2, body: 'Meh' });
    let prod = await Product.findById(p._id);
    assert.equal(prod.ratingCount, 2);
    assert.equal(prod.ratingAvg, 3.5);

    await review(b, p, { rating: 4, body: 'Better after a week' }); // edit, not a second review
    prod = await Product.findById(p._id);
    assert.equal(prod.ratingCount, 2);
    assert.equal(prod.ratingAvg, 4.5);
    assert.equal(await Review.countDocuments(), 2);

    const list = (await request(app).get(`/api/products/${p.slug}/reviews`)).body;
    assert.equal(list.total, 2);
    assert.equal(list.summary.avg, 4.5);
    assert.deepEqual(list.summary.breakdown, { 5: 1, 4: 1, 3: 0, 2: 0, 1: 0 });
    assert.deepEqual(list.items.map((r) => r.author).sort(), ['Aarav M.', 'Bhavna R.']); // never full names
    assert.equal(list.me, null);
  });

  test('validates ratings, and deleting updates the average', async () => {
    const p = await mkProduct();
    const admin = await adminAgent();
    const a = await signedIn('a@example.com');
    await deliveredTo(a, admin, p);
    assert.equal((await review(a, p, { rating: 6 })).status, 400);
    assert.equal((await review(a, p, { rating: 0 })).status, 400);
    assert.equal((await review(a, p, { rating: 'x' })).status, 400);
    assert.equal((await review(a, p, { rating: 5, body: 'x'.repeat(1501) })).status, 400);

    const made = await review(a, p, { rating: 5 });
    const other = await signedIn('c@example.com');
    assert.equal((await other.delete(`/api/reviews/${made.body.review.id}`)).status, 403);
    assert.equal((await a.delete(`/api/reviews/${made.body.review.id}`)).status, 200);
    const prod = await Product.findById(p._id);
    assert.equal(prod.ratingCount, 0);
    assert.equal(prod.ratingAvg, 0);
  });

  test('an admin can remove any review; sorting by rating puts the best first', async () => {
    const good = await mkProduct({ title: 'Good' });
    const meh = await mkProduct({ title: 'Meh' });
    const admin = await adminAgent();
    const a = await signedIn('a@example.com');
    await deliveredTo(a, admin, good);
    await deliveredTo(a, admin, meh);
    await review(a, good, { rating: 5 });
    const bad = await review(a, meh, { rating: 1 });
    const top = (await request(app).get('/api/products?sort=rating')).body.items;
    assert.deepEqual(top.map((x) => x.title), ['Good', 'Meh']);
    assert.equal((await admin.delete(`/api/reviews/${bad.body.review.id}`)).status, 200);
  });
});

describe('wishlist', () => {
  test('requires sign in; add is idempotent; list is newest first; remove works', async () => {
    const [p1, p2] = [await mkProduct({ title: 'One' }), await mkProduct({ title: 'Two' })];
    assert.equal((await request(app).get('/api/wishlist')).status, 401);

    const agent = await signedIn();
    await agent.put(`/api/wishlist/${p1._id}`);
    await agent.put(`/api/wishlist/${p1._id}`); // no duplicate
    await agent.put(`/api/wishlist/${p2._id}`);
    const list = (await agent.get('/api/wishlist')).body;
    assert.deepEqual(list.items.map((x) => x.title), ['Two', 'One']);
    assert.equal(list.ids.length, 2);

    await agent.delete(`/api/wishlist/${p1._id}`);
    assert.equal((await agent.get('/api/wishlist')).body.items.length, 1);
  });

  test('hidden or unknown products cannot be saved and drop out of the list', async () => {
    const hidden = await mkProduct({ active: false });
    const p = await mkProduct();
    const agent = await signedIn();
    assert.equal((await agent.put(`/api/wishlist/${hidden._id}`)).status, 404);
    assert.equal((await agent.put('/api/wishlist/507f1f77bcf86cd799439011')).status, 404);
    assert.equal((await agent.put('/api/wishlist/not-an-id')).status, 400);
    await agent.put(`/api/wishlist/${p._id}`);
    await Product.updateOne({ _id: p._id }, { active: false });
    assert.equal((await agent.get('/api/wishlist')).body.items.length, 0);
  });

  test('each customer has a private list', async () => {
    const p = await mkProduct();
    const a = await signedIn('a@example.com');
    const b = await signedIn('b@example.com');
    await a.put(`/api/wishlist/${p._id}`);
    assert.equal((await b.get('/api/wishlist')).body.items.length, 0);
  });
});
