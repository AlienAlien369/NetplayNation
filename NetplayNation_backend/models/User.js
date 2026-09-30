const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    wishlist: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    resetTokenHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
    passwordChangedAt: Date, // sessions issued before this are rejected
  },
  { timestamps: true }
);

module.exports = model('User', userSchema);
