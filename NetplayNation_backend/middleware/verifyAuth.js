const jwt = require('jsonwebtoken');

const authenticate = (req , res , next) => {
    console.log(req.url);
    console.log("dhbhsbhbcbxhdbxjs jbb shv ");
    try{
        console.log("entering the authenticate .......");
        const token  = req.headers.authorization ;
        const decode = jwt.verify(token , process.env.JWT_SECRET)
        console.log(token);
        // console.log(decode);
        req.user = decode
        if(decode.role == 'admin'){
            next()
        }
        else {
            res.status(450).json({
                message: "You are not Authorized"
            })
        }
    }
    catch(err){
        if(err.name == "TokenExpiredError"){
            res.status(401).json({
                message: " Plase login again "
            })
        }
        else{
            res.status(401).json({
                message: " authentication failed"
            })
        }
    }
}

const verifyToken = (req , res , next) => {
    try{
        const token = req.headers.authorization.split(' ')[1]
        const decode = jwt.verify(token , process.env.JWT_SECRET)
        console.log("entering the verify .......");
        console.log(decode)
        req.user = decode
        next()
        
    }
    catch(err){
        if(err.name == "TokenExpiredError"){
            res.json({
                message: " Plase login again "
            })
        }
        else{
            res.status(401).json({
                message: " authentication failed"
            })
        }
    }
}

module.exports = {authenticate,verifyToken};

