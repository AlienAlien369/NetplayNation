const bcrypt = require('bcryptjs');

// Demo catalog: invented brands and generic specs. Replace with your real products via the admin panel.
const P = (title, brand, category, price, mrp, stock, description, featured = false) => ({
  title, brand, category, price, mrp, stock, description, featured,
});

const DEMO = [
  P('Aero Pro 88 Badminton Racket', 'Kestrel', 'Badminton', 2499, 3299, 24, 'Isometric head, 88g (4U), medium-stiff shaft for control-first singles and doubles play. Strung and ready to play with a full cover.', true),
  P('Smash Carbon 100 Racket', 'Kestrel', 'Badminton', 4199, 5499, 12, 'Full carbon frame, 83g (5U), head-heavy balance for powerful overhead smashes.', true),
  P('Feather Shuttles, Tube of 12', 'Volt', 'Badminton', 899, 1099, 60, 'Goose feather shuttles with a cork base. Consistent flight for club-level and tournament practice.'),
  P('Court Grip Badminton Shoes', 'Volt', 'Badminton', 3299, 4299, 18, 'Non-marking gum sole, cushioned midsole and lateral support for quick court movement.'),
  P('Sweat-Wick Wrist Bands, Pair', 'Volt', 'Badminton', 199, null, 100, 'Cotton terry wrist bands that keep grip dry through long rallies.'),
  P('Racket Kit Bag, 6 Racket', 'Kestrel', 'Badminton', 1799, 2299, 15, 'Thermal-lined main compartment, separate shoe pocket, padded shoulder straps.'),

  P('English Willow Cricket Bat, Grade 2', 'Crease & Co', 'Cricket', 5999, 7999, 8, 'Grade 2 English willow with a thick edge and a full-sized profile. Comes unknocked.', true),
  P('Leather Cricket Ball, Set of 3', 'Crease & Co', 'Cricket', 999, 1299, 40, 'Four-piece hand-stitched leather ball, red, 156g. Suited to club and match play.'),
  P('Batting Gloves, Adult', 'Crease & Co', 'Cricket', 1299, 1699, 20, 'Pre-curved fingers with ventilated palms and reinforced thumb protection.'),
  P('Cricket Helmet with Steel Grille', 'Crease & Co', 'Cricket', 1999, 2499, 3, 'Adjustable fit, lightweight shell and a steel grille for face protection.'),
  P('Full Cricket Kit Bag', 'Crease & Co', 'Cricket', 2799, 3499, 10, 'Wheeled bag with separate compartments for bats, pads and shoes.'),

  P('Match Football, Size 5', 'Gridline', 'Football', 1199, 1599, 35, 'Machine-stitched TPU cover with a butyl bladder for consistent air retention.', true),
  P('Firm Ground Football Boots', 'Gridline', 'Football', 2699, 3499, 16, 'Studded outsole for firm natural grass, breathable synthetic upper.'),
  P('Shin Guards with Ankle Sleeve', 'Gridline', 'Football', 549, 799, 45, 'Lightweight hard shell with an EVA backing and a stay-put ankle sleeve.'),
  P('Goalkeeper Gloves', 'Gridline', 'Football', 1499, 1999, 14, 'Latex palm with finger protection and a wrap-around wrist strap.'),

  P('Road Running Shoes', 'Stridewell', 'Running', 3499, 4499, 30, 'Responsive foam midsole with an engineered mesh upper for daily road miles.', true),
  P('Lightweight Running Shorts', 'Stridewell', 'Running', 799, 1099, 50, 'Quick-dry fabric, built-in liner and a zip pocket for keys.'),
  P('Reflective Running Belt', 'Stridewell', 'Running', 499, null, 70, 'Stretch waist pouch that holds a phone up to 6.7 inches without bouncing.'),
  P('Performance Running Socks, 3 Pairs', 'Stridewell', 'Running', 449, 599, 80, 'Cushioned heel and toe, arch support and moisture-wicking yarn.'),

  P('Adjustable Dumbbell Set, 20 kg', 'Ironyard', 'Fitness', 3999, 5299, 9, 'Rubber-coated plates with a secure spin-lock collar. Two handles included.', true),
  P('Non-Slip Yoga Mat, 6 mm', 'Ironyard', 'Fitness', 899, 1299, 45, 'Dense cushioning with a textured surface for grip. Comes with a carry strap.'),
  P('Resistance Bands, Set of 5', 'Ironyard', 'Fitness', 649, 899, 55, 'Five resistance levels with a door anchor and a storage pouch.'),
  P('Speed Skipping Rope', 'Ironyard', 'Fitness', 299, 449, 90, 'Ball-bearing handles and an adjustable steel cable for fast rotations.'),
  P('Gym Gloves with Wrist Support', 'Ironyard', 'Fitness', 549, 749, 4, 'Padded palm and a Velcro wrist wrap for heavy lifting sessions.'),

  P('Club Tennis Racket, 27 in', 'Baseline', 'Tennis', 2899, 3799, 11, 'Aluminium frame, pre-strung, 270g with a comfortable grip for improving players.'),
  P('Pressureless Tennis Balls, Tube of 3', 'Baseline', 'Tennis', 599, 799, 50, 'Durable felt and a consistent bounce for regular practice sessions.'),
  P('Tennis Overgrip, Pack of 3', 'Baseline', 'Tennis', 349, null, 0, 'Tacky, absorbent overgrip that refreshes a worn handle in seconds.'),
];

async function seed({ adminEmail, adminPassword, demo = false }) {
  const User = require('./models/User');
  const Product = require('./models/Product');

  if (adminEmail && adminPassword) {
    const email = adminEmail.toLowerCase();
    if (!(await User.exists({ email }))) {
      await User.create({ name: 'Store Admin', email, passwordHash: await bcrypt.hash(adminPassword, 10), role: 'admin' });
      console.log(`Created admin ${email}`);
    } else {
      await User.updateOne({ email }, { role: 'admin' });
      console.log(`Existing user ${email} is now admin`);
    }
  }
  if (demo && (await Product.countDocuments()) === 0) {
    const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const now = Date.now();
    // Spread createdAt so "newest first" ordering is stable and varied.
    await Product.insertMany(
      DEMO.map((p, i) => ({ ...p, slug: slugify(p.title), images: [], createdAt: new Date(now - i * 3600e3) }))
    );
    console.log(`Seeded ${DEMO.length} demo products`);
  }
}

module.exports = { seed };

if (require.main === module) {
  (async () => {
    const config = require('./config');
    const mongoose = require('mongoose');
    if (!config.mongoUrl) throw new Error('MONGODB_URL is not set');
    await mongoose.connect(config.mongoUrl);
    await seed({
      adminEmail: process.env.ADMIN_EMAIL,
      adminPassword: process.env.ADMIN_PASSWORD,
      demo: process.argv.includes('--demo'),
    });
    await mongoose.disconnect();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
