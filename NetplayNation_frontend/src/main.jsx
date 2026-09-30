import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, CartProvider } from './state';
import { Layout, RequireAuth } from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Product from './pages/Product';
import Cart from './pages/Cart';
import { Login, Register } from './pages/Auth';
import { About, NotFound, Policy } from './pages/Static';

const Checkout = lazy(() => import('./pages/Checkout'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Admin = lazy(() => import('./pages/admin/Admin'));

const Fallback = <div className="container page" aria-busy="true"><div className="skeleton" style={{ height: 240 }} /></div>;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Toaster position="top-center" toastOptions={{ duration: 2500, style: { background: 'var(--ink)', color: 'var(--bg)', borderRadius: 10 } }} />
          <Suspense fallback={Fallback}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="shop" element={<Shop />} />
                <Route path="product/:slug" element={<Product />} />
                <Route path="cart" element={<Cart />} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="about" element={<About />} />
                <Route path="policies/:slug" element={<Policy />} />
                <Route path="checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
                <Route path="orders" element={<RequireAuth><Orders /></RequireAuth>} />
                <Route path="orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
                <Route path="admin/*" element={<RequireAuth admin><Admin /></RequireAuth>} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
