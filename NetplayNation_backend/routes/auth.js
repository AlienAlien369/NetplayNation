const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { z, parse } = require('../lib/validate');
const { HttpError } = require('../lib/http');
const { setSession, clearSession } = require('../middleware/auth');
const config = require('../config');
const emails = require('../lib/emails');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

const email = z.string().trim().toLowerCase().email('enter a valid email').max(120);
const registerBody = z.object({
  name: z.string().trim().min(2, 'enter your name').max(80),
  email,
  password: z.string().min(8, 'use at least 8 characters').max(72),
});
const loginBody = z.object({ email, password: z.string().min(1).max(72) });

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

router.post('/register', limiter, async (req, res) => {
  const { name, email, password } = parse(registerBody, req.body);
  try {
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
    setSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'An account with this email already exists');
    throw err;
  }
});

router.post('/login', limiter, async (req, res) => {
  const { email, password } = parse(loginBody, req.body);
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Incorrect email or password');
  }
  setSession(res, user);
  res.json({ user: publicUser(user) });
});

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Always answers the same way so the endpoint cannot be used to discover which emails have accounts.
router.post('/forgot', limiter, async (req, res) => {
  const { email: address } = parse(z.object({ email }), req.body);
  const user = await User.findOne({ email: address });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = sha256(token);
    user.resetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    emails.passwordReset(user, `${config.appUrl}/reset-password?token=${token}`);
  }
  res.json({ ok: true });
});

router.post('/reset', limiter, async (req, res) => {
  const { token, password } = parse(
    z.object({ token: z.string().min(20).max(200), password: z.string().min(8, 'use at least 8 characters').max(72) }),
    req.body
  );
  const user = await User.findOne({ resetTokenHash: sha256(token), resetExpires: { $gt: new Date() } }).select('+resetTokenHash +resetExpires');
  if (!user) throw new HttpError(400, 'This reset link is invalid or has expired. Please request a new one.');
  user.passwordHash = await bcrypt.hash(password, 10);
  user.resetTokenHash = undefined;
  user.resetExpires = undefined;
  user.passwordChangedAt = new Date();
  await user.save();
  setSession(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

module.exports = router;
