import React , { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';



const Login = () => {

  const [data, setData] = useState({ email: '', password: '' , prevToken: ''});

  const loginUser = async (e) => {
    e.preventDefault();
    try {
      let prevToken = localStorage.getItem("userToken"); // Retrieve the previous token from localStorage
      if(prevToken !== null){
        setData({...data , prevToken: prevToken}); // Update the data state with the previous token
      }
      console.log(prevToken); // Log the previous token
      const res = await axios.post("auth/signin" , data , {withCredentials:true});
      console.log("data: ", res.data);
      localStorage.setItem("userToken", res.data.data.token); // Set the new token in localStorage
  
    } catch (err) {
      console.error("error: ", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    console.log(data);
    setData({ ...data, [name]: value });
  };

  return (
    <>
      <form onSubmit={loginUser} className='w-25 m-auto p-4 mt-5 border border-dark rounded'>
        <h3>Sign In</h3>
        <div className="mb-3">
          <label>Email address</label>
          <input
            type="email"
            className="form-control"
            placeholder="Enter email"
            name="email"
            value={data.email}
            onChange={handleInputChange}
          />
        </div>
        <div className="mb-3">
          <label>Password</label>
          <input
            type="password"
            className="form-control"
            placeholder="Enter password"
            name="password"
            value={data.password}
            onChange={handleInputChange}
          />
        </div>
        
        <div className="d-grid mt-4">
          <button type="submit" className="btn btn-primary">
            Submit
          </button>
        </div>
        <p className="forgot-password text-right">
          Forgot Password?
        </p>
        <p className="forgot-password text-right">
          Not a Member? <Link to="/signup">Want to sign up?</Link>
        </p>
      </form>
    </>
  );
};

export default Login;
