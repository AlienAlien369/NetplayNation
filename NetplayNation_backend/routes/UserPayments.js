const express = require('express');
const router = express.Router();
const {
    test,
    CreatePayment,
    PaymentVerification
} = require('../controllers/PaymentControllers')

router.get('/test', test);
router.post('/CreatePayment', CreatePayment);
router.post('/PaymentVerification', PaymentVerification);


module.exports = router;





