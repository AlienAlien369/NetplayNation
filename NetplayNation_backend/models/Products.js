const mongoose = require('mongoose');
const { Schema } = mongoose;

const ProductSchema = new Schema({
    ProductImage: String,
    ProductTitle: String,
    ProductDesc: String,
    ProductPrice: Number
})


const ProductModel = mongoose.model('NewProduct',ProductSchema);

module.exports = ProductModel;