const Products = require('../models/Products');

const allProducts = async(req,res) => {
    try {
        const allProductsData = await Products.find();
        res.status(200).json( {data : allProductsData} );
        // console.log("fetching")
    } catch (error) {
        res.status(400).json({
            error : " you are facing an issue "
        })
    }
}


module.exports = {
    allProducts
}