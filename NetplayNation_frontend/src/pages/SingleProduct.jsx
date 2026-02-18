import React from 'react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import '../scss/productPage.scss';

const SingleProduct = ({ tempid, productImage, productName, productDesc, productPrice }) => {

  const [Quantity, setQuantity] = useState(0);
  const [amount, setAmount] = useState(0);


  const incrementQuantity = () => {
    setQuantity(Quantity + 1);
  };

  const decrementQuantity = () => {
    if (Quantity > 0) {
      setQuantity(Quantity - 1);
    }
  };

  // const initPayment = (data) => {
  //   const options = {
  //     key: "rzp_test_3wQOEb7uiW76Ar",
  //     amount: data.amount,
  //     currency: data.currency,
  //     name: productName,
  //     description: "Test Transaction",
  //     order_id: data.id,
  //     handler: async (response) => {
  //       try {
  //         const data = await axios.post("​/payment/PaymentVerification", response);
  //         console.log(data);
  //       }
  //       catch (error) {
  //         console.log(error);
  //       }
  //     }
  //   };

  //   const rzp1 = new window.Razorpay(options);
  //   rzp1.open();
  // }


  const handelPayment = async () => {
    console.log("handlePayment entering");
    // try {
    //   const { data } = await axios.post("/payment/CreatePayment", { amount: (Quantity * productPrice * 100)});
    //   console.log(data);
    //   console.log(data.amount);
    //   console.log(data.data.amount);
    //   console.log(window);
    //   // const { verify } = await axios.post("/payment/PaymentVerification", {{razorpay_order_id :order_O7IyXC8Sg6zRng ,razorpay_payment_id : razorpay_signature }} );
    //   // console.log(verify);
    //   // initPayment(data.data);
    //   const options = {
    //     key: "rzp_test_3wQOEb7uiW76Ar",
    //     amount: data.data.amount, // Amount is in currency subunits. Default currency is INR. Hence, 50e0e refers to
    //     currency: "INR",
    //     name: "Acme Corp",
    //     description: "Test Transaction",
    //     image: "https://example.com/your_logo",
    //     order_id: data.data.id, //This is a sample Order ID. Pass the 'id' obtained in the respons
    //     callback_url: "​http://localhost:8080/payment/PaymentVerification",
    //     prefill: {
    //       name: "Gaurav Kumar",
    //       email: "gaurav.kumar@example.com",
    //       contact: "9999999999"
    //     },
    //     notes: {
    //       "address": "Razorpay Corporate Office"
    //     },
    //     theme: {
    //       "color": "#3399cc"
    //     }
    //   };
    //   var rzp1 = new window.Razorpay(options);
    //   rzp1.open();
    //     toast.success('Your payment was successful');
    //   } catch (error) {
    //     console.log(error);
    //     toast.error('Your payment failed');
    //   }
    };

    console.log(amount);
    return (
      <div className="product-page">
        <div className="product-image" style={{height:'100%'}}>
          <img src={productImage} alt={productName} />
        </div>
        <div className="product-info">
          <h1>{productName}</h1>
          <p>{productDesc}</p>
          <p>Price: Rs.{productPrice}</p>
          <div className='my-5'>
            <button onClick={decrementQuantity}>-</button>
            <input
              style={{ width: '50px' }}
              type="number"
              value={Quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
            />
            <button onClick={incrementQuantity}>+</button>
          </div>
          <div className='d-flex justify-content-between '>
            <button className="btn btn-primary " onClick={handelPayment}>Buy Now</button>
            <button className="btn btn-primary ">Add to Cart</button>
          </div>
        </div>
      </div>
    );
  };

  export default SingleProduct;