const express = require('express');
// const router = express.Router();
const dotenv = require('dotenv'); // Correct import statement
const cors = require('cors');
const app = express();
const mongoose  = require('mongoose');
const Razorpay = require('razorpay');

dotenv.config(); // Load environment variables from .env file


mongoose.connect(process.env.MONGODB_URL)
    .then(() => {
        console.log('momgo db connected successfully');
    })
    .catch((err) => {
        console.log('mongodb not connected due to : ', err);
    })

app.use(express.json());


app.use(cors({
    origin: process.env.FRONTEND_URL ,
    credentials: true,
}));

app.get('/', (req, res) => {
    res.send("hello server");
});
app.use('/auth', require('./routes/authRoutes'));
app.use('/adminpanel', require('./routes/AdminRoutes'));
app.use('/user', require('./routes/UserRoutes'));
app.use('/payment', require('./routes/UserPayments'));

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_ID_KEY, 
    key_secret:  process.env.RAZORPAY_SECRET_KEY 
});

app.post('/create-order', async (req, res) => {
    try {
      const order = await instance.orders.create({
        amount: 50000,
        currency: 'INR',
        receipt: 'eceipt#1',
        partial_payment: false,
        notes: {
          key1: 'value3',
          key2: 'value2',
        },
      });
      res.json(order);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  });
  
  app.post('/create-payment', async (req, res) => {
    try {
      const payment = await instance.payments.createPaymentJson({
        amount: 100,
        currency: 'INR',
        order_id: 'order_EAkbvXiCJlwhHR',
        email: 'gaurav.kumar@example.com',
        contact: '9090909090',
        method: 'upi',
        vpa: '9090909090@oksomebank',
        ip: '192.168.0.103',
        referer: 'http',
        user_agent: 'Mozilla/5.0',
        description: 'Test payment',
        notes: {
          note_key: 'value1',
        },
      });
      res.json(payment);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create payment' });
    }
  });
  
  app.post('/callback', async (req, res) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
      const generatedSignature = hmac_sha256(razorpay_order_id + '|' + razorpay_payment_id, process.env.RAZORPAY_KEY_SECRET);
      if (generatedSignature === razorpay_signature) {
        // Payment successful
        res.json({ success: true });
      } else {
        // Payment failed
        res.json({ success: false });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to verify payment signature' });
    }
  });


const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log('Server is running on port ' + PORT);
});
