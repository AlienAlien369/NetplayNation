const express = require('express');
const cors = require('cors');
const router = express.Router();

const {
    test,
    registerUser,
    signinUser
} = require('../controllers/authController');

// Middleware



router.get('/test', test);
router.post('/register', registerUser);
router.post('/signin', signinUser);

module.exports = router