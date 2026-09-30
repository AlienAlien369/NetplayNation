const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const COOKIE = 'token';
const WEEK = 7 * 24 * 60 * 60 * 1000;

exports.setSession = (res, user) => {
  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.prod,
    maxAge: WEEK,
  });
};

exports.clearSession = (res) => res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.prod });

// Attaches req.user when a valid session cookie exists; never rejects.
exports.loadUser = async (req, _res, next) => {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { sub, iat } = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(sub);
      const changed = user?.passwordChangedAt ? Math.floor(user.passwordChangedAt.getTime() / 1000) : 0;
      if (user && iat >= changed) req.user = user; // password change/reset signs out older sessions
    } catch {
      /* invalid or expired token: treat as signed out */
    }
  }
  next();
};

exports.requireAuth = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: 'Please sign in to continue' });

exports.requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};
