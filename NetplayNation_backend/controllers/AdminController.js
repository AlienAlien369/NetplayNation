const NewProduct = require('../models/Products')
const express = require('express');


const test = (req,res) =>{
    res.status(200).json("test is working in admin pannel");
}

const ProductUplaod = async(req,res) => {
    try{
        const userToken = req.body;
        // if()
        const {ProductImage, ProductTitle, ProductDesc, ProductPrice} = req.body;
        const product = await NewProduct.create({
            ProductImage, ProductTitle, ProductDesc, ProductPrice
        })
        console.log({product});
        res.status(200).json({product});
    }
    catch{
        res.status(400).json("error");
    }
}









module.exports = {
    test,
    ProductUplaod
}