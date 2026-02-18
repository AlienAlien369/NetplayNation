const Razorpay = require('razorpay');
const crypto = require('crypto');

const test = async (req, res) => {
    res.status(200).json("the payment is working in test mode");
}

// /////////////////////////////creating payment
const CreatePayment = async (req, res) => {
    const { amount } = req.body;
    console.log(amount);
    try {
        const instance = new Razorpay({
            key_id: process.env.RAZORPAY_ID_KEY,
            key_secret: process.env.RAZORPAY_SECRET_KEY
        });
        const options = {
            "amount": amount,
            "currency": "INR",
            "receipt": "receipt#1",
        }
        instance.orders.create(options, (error, order) => {
            if (error) {
                res.status(500).json("something went wrong");
            }
            res.status(200).json({ data: order, success: true });
        })
    } catch (error) {
        res.status(400).json("your payment is failed");
    }
}
const PaymentVerification = (req, res) => {
    // try {
    //     const {
    //     razorpay_order_id,
    //     razorpay_payment_id,
    //     razorpay_signature } = req.body;
    //     const sign = razorpay_order_id + "|" + razorpay_payment_id;
    //     const expectedSign = crypto
    //     .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
    //     .update(sign.toString())
    //     .digest("hex");

    //     if (razorpay_signature === expectedSign) {
    //         return res.status(200).json({ message: "Payment verified successfully" });
    //     } else{
    //         return res.status(400).json({ message: "Invalid signature sent!" });
    //     }
    // }  
    // catch (error) {
    //     console.log(error);
    //     res.status(500).json({ message: "Internal Server Error!" });
    // }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_APT_SECRET)
        .update(body.toString())
        .digest("hex");
    console.log("sig received ", razorpay_signature);
    console.log("sig generated ", expectedSignature);

        res.status(200).json({
            success: true,
        });
    return res.status(200).json({ success: true });

}


module.exports = {
    test,
    CreatePayment,
    PaymentVerification
}