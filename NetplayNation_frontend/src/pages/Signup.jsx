import React, { useState } from 'react'
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Signup = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({ name: '', referal: '', email: '', password: '' });

  const registerUser = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/auth/register', data , { withCredentials: true });
      const responseData = response.data;
      console.log(responseData);
      if (responseData.error) {
        toast.error(responseData.error);
      } else {
        setData({ name: '', email: '', password: '' });
        toast.success('Registration successful');
        navigate('/login');
      }
    } catch (error) {
      console.error('Error registering user:', error);
      toast.error('An error occurred while registering. Please try again.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    console.log(data);
    setData({ ...data, [name]: value });
  };

  return (<>

      <form onSubmit={registerUser} className='w-25 m-auto p-4 mt-5 border border-dark rounded'>
        <h3>Sign Up</h3>
        <div className="mb-3">
          <label>Name</label>
          <input
            type="text"
            className="form-control"
            placeholder="Name"
            name="name"
            value={data.name}
            onChange={handleInputChange}
          />
        </div>
        <div className="mb-3">
          <label>Referal Code</label>
          <input
            type="email"
            className="form-control"
            placeholder="Referal Code"
            name="referal"
            value={data.referal}
            onChange={handleInputChange}
          />
        </div>
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
        <div className="d-grid">
          <button type="submit" className="btn btn-primary">Sign Up</button>
        </div>
        <p className="forgot-password text-right">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>

  </>
  )
}

export default Signup