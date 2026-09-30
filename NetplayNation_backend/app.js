const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { loadUser } = require('./middleware/auth');

mongoose.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    return ret;
  },
});

const app = express();
if (config.prod) app.set('trust proxy', 1); // behind Render/Heroku-style proxies

app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // Razorpay checkout opens a popup
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'https://*.razorpay.com'],
        frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: config.prod ? [] : null,
      },
    },
  })
);
app.use(compression());
// Must come before express.json(): the webhook signature is computed over the raw bytes.
app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json', limit: '100kb' }), require('./routes/webhooks'));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

app.get('/healthz', (_req, res) => res.json({ ok: true }));

const api = express.Router();
api.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: process.env.NODE_ENV === 'test' ? 100000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  })
);
api.use(loadUser);
api.use('/auth', require('./routes/auth'));
api.use('/orders', require('./routes/orders'));
api.use('/admin', require('./routes/admin'));
api.use('/', require('./routes/shop'));
api.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use('/api', api);

// Serve the built React app from the same origin (production).
const dist = path.join(__dirname, '..', 'NetplayNation_frontend', 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(
    express.static(dist, {
      index: false,
      setHeaders: (res, file) => {
        res.setHeader(
          'Cache-Control',
          file.endsWith('.html') ? 'no-cache' : file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'public, max-age=86400'
        );
      },
    })
  );
  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || !req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });
  console.error(err);
  res.status(err.status || 500).json({ error: config.prod ? 'Something went wrong' : err.message });
});

module.exports = app;
