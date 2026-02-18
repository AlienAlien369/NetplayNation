const { mongoose } = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    referal: {
        type: String
    },
    email: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String
    },
    token: {
        type: String
    },
    cart : {
        type: Array
    }
})


const UserModel = mongoose.model('User', userSchema);

module.exports = UserModel;