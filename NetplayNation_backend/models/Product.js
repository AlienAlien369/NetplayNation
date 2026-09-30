const { Schema, model } = require('mongoose');

const productSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '', maxlength: 4000 },
    brand: { type: String, required: true, trim: true, maxlength: 60 },
    category: { type: String, required: true, trim: true, maxlength: 60, index: true },
    price: { type: Number, required: true, min: 1 },
    mrp: { type: Number, min: 1 }, // list price; shown struck through when above price
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: { type: [String], default: [] },
    ratingAvg: { type: Number, default: 0 }, // kept in sync by the review routes
    ratingCount: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ active: 1, createdAt: -1 });
productSchema.index({ active: 1, price: 1 });

module.exports = model('Product', productSchema);
