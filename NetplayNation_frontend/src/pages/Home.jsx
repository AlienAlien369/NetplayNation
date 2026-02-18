import React, { useEffect, useState } from 'react';
import heroimg from '../assests/vectors/smashing2.webp'
import Product from '../pages/Products'
import ProductCard from '../components/ProductCard';
import FooterComponent from '../components/FooterComponent'
import axios from 'axios';
import {toast} from 'react-hot-toast';
import Heading from '../sub_components/Heading'


const Home = () => {

  const [data, setData] = useState([]);
  // const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("before")
    const fetchData = async () => {
      try {
        const response = await axios.get('/user/allproducts');
        console.log ("after call")
        setData(response.data.data);
        console.log(response.data.data)
        // setLoading(false)
        toast.success('Your products have been successfully fetched');
      } catch (error) {
        console.error("Error:", error);
        toast.error('Failed to fetch products');
      }
    };

    fetchData();
  }, []);


  return (
    <>
      <section className='w-75 m-auto d-flex align-items-center'>
        <div>
          <img src={heroimg}  style={{width: "50%"}} alt="" />
        </div>
        <div className=''>
          <h1>Netplay Nation</h1>
          <h3>Gear Up , Level Up !</h3>
        </div>
      </section>
      <Heading text="Products" style={{ border: '1px dotted black'}}/>
          <section style={{width:'80%', display:'flex', justifyContent:'center', alignItems:'center' , flexWrap:'wrap' , margin:'auto'}}>
            {data.map((product, index) => (
              <ProductCard
                key={product._id}
                tempid={product._id}
                productImage={product.ProductImage}
                productName={product.ProductTitle}
                productDesc={product.ProductDesc}
                productPrice={product.ProductPrice}
              />
            ))}
          </section>
      <FooterComponent/>

    </>
  )
}

export default Home