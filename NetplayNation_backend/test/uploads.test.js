const { test, describe } = require('node:test');
const { app, request, assert, crypto, useDb, signedIn, adminAgent } = require('./helpers');

useDb();

describe('image upload signing', () => {
  test('admins get a valid Cloudinary signature and the secret is never exposed', async () => {
    const admin = await adminAgent();
    const res = await admin.post('/api/admin/upload-signature');
    assert.equal(res.status, 200);
    const { cloudName, apiKey, timestamp, folder, signature } = res.body;
    assert.equal(cloudName, 'democloud');
    assert.equal(apiKey, '123456789012345');
    const expected = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}cloud_secret`).digest('hex');
    assert.equal(signature, expected);
    assert.ok(Math.abs(timestamp - Date.now() / 1000) < 10);
    assert.ok(!JSON.stringify(res.body).includes('cloud_secret'));
  });

  test('customers and anonymous users cannot request signatures', async () => {
    assert.equal((await request(app).post('/api/admin/upload-signature')).status, 401);
    const customer = await signedIn();
    assert.equal((await customer.post('/api/admin/upload-signature')).status, 403);
  });

  test('config tells the admin UI whether uploads are available', async () => {
    assert.equal((await request(app).get('/api/config')).body.uploadsEnabled, true);
  });
});
