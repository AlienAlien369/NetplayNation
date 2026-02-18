import React, { useState } from 'react'
import axios from 'axios';
import {toast} from 'react-hot-toast'

const AdminProductForm = () => {

  const [ProductData , setProductData] = useState({ProductImage: '' , ProductTitle: '' , ProductDesc: '', ProductPrice: 0, ProductQuantity: 0});

  const handleInputChange = (e) => {
    const {name , value} = e.target;
    console.log(ProductData);
    setProductData({...ProductData , [name]: value});
  }

  const ProductUploaded = async(e) => {
    e.preventDefault();
    console.log('entering product upload');
    try{
      console.log(localStorage.getItem('userToken'));
      const response = await axios.post('/adminpanel/ProductUplaod', ProductData , {headers:{  Authorization: `Bearer ${localStorage.getItem('userToken')}`}});
      console.log(response);
      if (response.status >= 200 && response.status < 300) {
        toast.success("successfully uploaded");
      }
    }
    catch(error){
      console.log(error);
      toast.error("nottt successfully uploaded");
    }
  }

  return (
    <>
      <form onSubmit={ProductUploaded} className='w-25 m-auto p-4 mt-5 border border-dark rounded'>
        <h3>Product Upload</h3>
        <div className="mb-3">
          <label>Product image</label>
          <input
            type="text"
            className="form-control"
            placeholder="Enter product Image"
            name="ProductImage"
            value={ProductData.ProductImage}
            onChange={handleInputChange}
          />
        </div>
        <div className="mb-3">
          <label>Product Name</label>
          <input
            type="text"
            className="form-control"
            placeholder="Enter Product Name"
            name="ProductTitle"
            value={ProductData.ProductTitle}
            onChange={handleInputChange}
          />
        </div>
        <div className="mb-3">
          <label>Product Description</label>
          <input
            type="text"
            className="form-control"
            placeholder="Enter Product Description"
            name="ProductDesc"
            value={ProductData.ProductDesc}
            onChange={handleInputChange}
          />
        </div>
        <div className="mb-3">
          <label>ProductPrice</label>
          <input
            type="Number"
            className="form-control"
            placeholder="Enter Product Price"
            name="ProductPrice"
            value={ProductData.ProductPrice}
            onChange={handleInputChange}
          />
        </div>
        
        
        <div className="d-grid mt-4">
          <button type="submit" className="btn btn-primary">
            Submit
          </button>
        </div>
      </form>
    </>

  )
}

export default AdminProductForm
