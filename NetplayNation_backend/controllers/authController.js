const User = require('../models/User')
const bcrypt = require('bcrypt');
const saltRounds = 10;
const jwt = require('jsonwebtoken');


const test = (req, res) => {
    res.json('test is working');
}


const registerUser = async (req, res) => {
    // console.log("hi entring register")
    try {
        const { name, referal, email, password } = req.body;

        //for name
        if (!name) {
            return res.status(400).json({
                error: 'fill the name'
            })
        }
        ///for password
        if (password.length < 6)
            return res.status(400).json({
                error: "password should be greater that 6 letters"
            })

        //for referal
        if (referal !== '') {
            const referalFounded = await User.findOne({ referal });
            if (!referalFounded) {
                res.status(404).json({
                    error: "Referral email is wrong!"
                })
            }
        }

        ////for existing user
        const exist = await User.findOne({ email });

        if (exist) {
            res.status(404).json({
                error: "email already exist"
            })
        }

        ///creating  a new user

        const salt = bcrypt.genSaltSync(saltRounds);
        const hashPassword = bcrypt.hashSync(password, salt);
        console.log(hashPassword);

        const user = await User.create({
            name, referal, email, password : hashPassword, role: "user", token:"", cart:[]
        })
        console.log(user);
         return res.json({ user });
    }
    catch (error) {
        console.error('Error registering user:', error);
        return res.status(500).json({ error: 'An error occurred while registering the user' });
    }
}


const signinUser = async (req, res) => {
    const { email, password, prevToken } = req.body;
    
    try {
        // Find user by email
        const user = await User.findOne({ email });
        // console.log(email + 'jbhdcjdjh');
        // If user not found
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        // Check if password matches
        if (bcrypt.compareSync(password, user.password)) {
            const newToken = jwt.sign({
              data: user
            }, process.env.JWT_SECRET, { expiresIn: "600" });
            console.log(prevToken); 
            console.log(newToken); // Logging the new token, not 'token'
            User.findOneAndUpdate(
                { _id: user._id }, // Filter condition: find the user by ID
                { $set: { token: newToken } }, // Update operation: set the token to the new value
                { new: true } // Options: return the updated document
              )
              .then(updatedUser => {
                console.log('User token updated successfully:', updatedUser);
              })
              .catch(err => {
                console.error('Error updating user token:', err);
              });
          
            return res.status(200).json({
                data: user,
                message: "Welcome user"
            });
        } else {
            return res.status(401).json({
                message: "Incorrect password"
            });
        }
    } catch (error) {
        console.error("Error signing in:", error);
        return res.status(500).json({
            message: "An error occurred while signing in"
        });
    }
};


module.exports = {
    test,
    registerUser,
    signinUser
}