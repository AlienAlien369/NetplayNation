const express = require('express');
const router = express.Router();
const {authenticate} = require('../middleware/verifyAuth')


const {
    test,
    ProductUplaod
} = require('../controllers/AdminController');

router.post('/ProductUplaod', authenticate , ProductUplaod)


module.exports = router;

