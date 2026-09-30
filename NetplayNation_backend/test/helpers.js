process.env.NODE_ENV = 'test';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
process.env.CLOUDINARY_CLOUD_NAME = 'democloud';
process.env.CLOUDINARY_API_KEY = '123456789012345';
process.env.CLOUDINARY_API_SECRET = 'cloud_secret';

const { before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { seed } = require('../seed');
const mail = require('../lib/mail');
const razorpay = require('../lib/razorpay');

// Registers DB lifecycle hooks: one in-memory MongoDB per test file, wiped before each test.
function useDb(extraModels = []) {
  let mongod;
  const models = () => [User, Product, Order, ...extraModels];
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri('test'));
    await Promise.all(models().map((m) => m.init()));
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    mail.outbox.length = 0;
    await Promise.all(models().map((m) => m.deleteMany({})));
  });
}

const address = { name: 'Riya Sharma', phone: '9876543210', line1: '12 MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411001' };

const mkProduct = (over = {}) =>
  Product.create({ title: 'Test Racket', slug: `test-racket-${crypto.randomBytes(3).toString('hex')}`, brand: 'Kestrel', category: 'Badminton', price: 1000, stock: 10, ...over });

async function signedIn(email = 'riya@example.com', name = 'Riya Sharma') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name, email, password: 'password123' });
  assert.equal(res.status, 201);
  return agent;
}
async function adminAgent() {
  await seed({ adminEmail: 'boss@example.com', adminPassword: 'password123' });
  const agent = request.agent(app);
  assert.equal((await agent.post('/api/auth/login').send({ email: 'boss@example.com', password: 'password123' })).status, 200);
  return agent;
}
const order = (agent, items, over = {}) => agent.post('/api/orders').send({ items, address, paymentMethod: 'cod', ...over });
const line = (p, qty = 1) => ({ productId: String(p._id), qty });

// Replaces razorpay network calls with fakes; returns a function that restores the originals.
function stubRazorpay(over = {}) {
  const orig = { ...razorpay };
  razorpay.createOrder = async ({ amountRupees }) => ({ id: `order_${crypto.randomBytes(4).toString('hex')}`, amount: amountRupees * 100 });
  razorpay.refund = async () => ({ id: `rfnd_${crypto.randomBytes(4).toString('hex')}` });
  Object.assign(razorpay, over);
  return () => Object.assign(razorpay, orig);
}
const rzpSign = (o, p) => crypto.createHmac('sha256', 'rzp_test_secret').update(`${o}|${p}`).digest('hex');

module.exports = { app, request, assert, crypto, mongoose, User, Product, Order, mail, razorpay, useDb, address, mkProduct, signedIn, adminAgent, order, line, stubRazorpay, rzpSign };
