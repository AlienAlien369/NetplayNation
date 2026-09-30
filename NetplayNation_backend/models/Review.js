const { Schema, model } = require('mongoose');

const reviewSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true }, // public name, e.g. "Riya S."
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 80, default: '' },
    body: { type: String, trim: true, maxlength: 1500, default: '' },
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, user: 1 }, { unique: true }); // one review per customer per product
reviewSchema.index({ product: 1, createdAt: -1 });

module.exports = model('Review', reviewSchema);
