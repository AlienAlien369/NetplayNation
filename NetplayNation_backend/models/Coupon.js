const { Schema, model } = require('mongoose');

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9_-]{3,20}$/ },
    description: { type: String, default: '', maxlength: 140 },
    type: { type: String, enum: ['percent', 'flat'], required: true },
    value: { type: Number, required: true, min: 1 }, // percent (1-100) or rupees
    minSubtotal: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, min: 1 }, // cap for percent coupons
    expiresAt: Date,
    usageLimit: { type: Number, min: 1 }, // total redemptions across all customers
    perUserLimit: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = model('Coupon', couponSchema);
