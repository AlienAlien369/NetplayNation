import React , {useState , useEffect} from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavbarComponent from './components/NavbarComponent'
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Products from './pages/Products';
import AdminPage from './pages/AdminPage';
import About from './pages/About'
import AdminProductForm from './pages/AdminPages/AdminProductForm';
import NewAdminPage from './pages/AdminPages/NewAdminPage';
import SingleProduct from './pages/SingleProduct';
import axios from 'axios';
import { Toaster , toast} from 'react-hot-toast'
// import {data} from './pages/Products'

axios.defaults.baseURL = import.meta.env.VITE_AXIOS_BACKEND_BASE_URL;
axios.defaults.withCredentials = true;



const App = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/user/allproducts');
        setData(response.data.data);
        console.log(response.data.data)
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
      <Toaster position='top-right' toastOptions={{ duration: 2000 }} />
      <Router>
        <NavbarComponent />
        <Routes>
          <Route exact path='/' element={< Home />}></Route>
          <Route exact path='/about' element={< About />}></Route>
          <Route exact path='/login' element={< Login />}></Route>
          <Route exact path='/signup' element={< Signup />}></Route>
          <Route exact path='/products' element={< Products />}></Route>
          {data.map((product, index) => (
            <Route 
            key={product._id}
            exact path={`/products/${product._id}`} 
            element={< SingleProduct 
                key={product._id}
                productImage={product.ProductImage}
                productName={product.ProductTitle}
                productDesc={product.ProductDesc} 
                productPrice={product.ProductPrice}
                />}
              >
            </Route>
            ))}
          <Route exact path='/adminpanel' element={< AdminPage />}></Route>
          <Route exact path='/adminpanel/uploadproduct' element={< AdminProductForm />}></Route>
          <Route exact path='/adminpanel/newadmin' element={< NewAdminPage />}></Route>
        </Routes>
      </Router>

    </>
  );
};

export default App;
