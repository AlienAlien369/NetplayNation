const express = require('express');
const router = express.Router();

const {
    allProducts
} = require('../controllers/userController');



router.get('/allproducts' , allProducts);

module.exports = router;