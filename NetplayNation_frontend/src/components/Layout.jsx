import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardText, Heart, List, MagnifyingGlass, ShoppingCartSimple, SignOut, Storefront, User, X } from '@phosphor-icons/react';
import { useAuth, useCart, useWishlist } from '../state';
import { SITE } from '../site';

function SearchBox({ onDone }) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  return (
    <form
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        nav(q.trim() ? `/shop?q=${encodeURIComponent(q.trim())}` : '/shop');
        onDone?.();
      }}
    >
      <MagnifyingGlass size={18} />
      <label className="sr-only" htmlFor="site-search">Search products</label>
      <input id="site-search" className="input" type="search" placeholder="Search rackets, bats, boots" value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} />
    </form>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const nav = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!user) {
    return (
      <>
        <Link className="btn btn-sm signin-text" to="/login" style={{ marginLeft: 6 }}>Sign in</Link>
        <Link className="icon-btn signin-icon" to="/login" aria-label="Sign in"><User size={24} /></Link>
      </>
    );
  }
  return (
    <div className="rel" ref={ref}>
      <button className="icon-btn" aria-label="Account menu" aria-expanded={open} onClick={() => setOpen(!open)}><User size={24} /></button>
      {open && (
        <div className="menu">
          <div className="who"><b>{user.name}</b><div className="muted" style={{ fontSize: '.9rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div></div>
          <Link to="/orders"><ClipboardText size={20} /> My orders</Link>
          <Link to="/wishlist"><Heart size={20} /> Wishlist</Link>
          {user.role === 'admin' && <Link to="/admin"><Storefront size={20} /> Admin panel</Link>}
          <button onClick={async () => { await logout(); nav('/'); }}><SignOut size={20} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

function Header() {
  const { count } = useCart();
  const wish = useWishlist();
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  return (
    <header className="header">
      <div className="container">
        <div className="header-row">
          <Link to="/" className="brand" aria-label={`${SITE.name} home`}>
            <span className="brand-mark" aria-hidden="true">N</span>
            <span>{SITE.name}</span>
          </Link>
          <nav className="nav" aria-label="Main">
            <NavLink to="/shop">Shop</NavLink>
            <NavLink to="/about">About</NavLink>
          </nav>
          <SearchBox />
          <div className="header-actions">
            <Link to="/wishlist" className="icon-btn hide-mobile" aria-label={`Wishlist, ${wish.count} item${wish.count === 1 ? '' : 's'}`}>
              <Heart size={26} />
              {wish.count > 0 && <span className="cart-count">{wish.count}</span>}
            </Link>
            <Link to="/cart" className="icon-btn" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
              <ShoppingCartSimple size={26} />
              {count > 0 && <span className="cart-count">{count}</span>}
            </Link>
            <AccountMenu />
            <button className="icon-btn only-mobile" aria-label={drawer ? 'Close menu' : 'Open menu'} aria-expanded={drawer} onClick={() => setDrawer(!drawer)}>
              {drawer ? <X size={26} /> : <List size={26} />}
            </button>
          </div>
        </div>
        {drawer && (
          <div className="only-mobile">
            <div className="mobile-search"><SearchBox onDone={() => setDrawer(false)} /></div>
            <nav className="drawer" aria-label="Mobile">
              <Link to="/shop">Shop</Link>
              <Link to="/about">About</Link>
              <Link to="/policies/shipping">Shipping and returns</Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="about">
            <span className="brand"><span className="brand-mark" aria-hidden="true">N</span>{SITE.name}</span>
            <p style={{ marginTop: 12 }}>Sports gear for every game, delivered across India. Cash on delivery and secure online payment.</p>
          </div>
          <div>
            <h4>Shop</h4>
            <ul>
              <li><Link to="/shop">All products</Link></li>
              <li><Link to="/shop?category=Badminton">Badminton</Link></li>
              <li><Link to="/shop?category=Cricket">Cricket</Link></li>
              <li><Link to="/shop?category=Fitness">Fitness</Link></li>
            </ul>
          </div>
          <div>
            <h4>Help</h4>
            <ul>
              <li><Link to="/orders">Track an order</Link></li>
              <li><Link to="/policies/shipping">Shipping</Link></li>
              <li><Link to="/policies/returns">Returns and refunds</Link></li>
              <li><Link to="/policies/privacy">Privacy</Link></li>
              <li><Link to="/policies/terms">Terms</Link></li>
            </ul>
          </div>
          <div>
            <h4>Contact</h4>
            <ul>
              <li><a href={`mailto:${SITE.email}`}>{SITE.email}</a></li>
              <li><a href={`tel:${SITE.phone.replace(/\s/g, '')}`}>{SITE.phone}</a></li>
              <li>{SITE.city}</li>
            </ul>
          </div>
        </div>
        <div className="footer-base">
          <span>&copy; {new Date().getFullYear()} {SITE.name}. All rights reserved.</span>
          <span>Prices in INR, inclusive of taxes.</span>
        </div>
      </div>
    </footer>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1}><Outlet /></main>
      <Footer />
    </>
  );
}

export function RequireAuth({ admin = false, children }) {
  const { user, loading } = useAuth();
  const { pathname, search } = useLocation();
  if (loading) return <div className="container page" aria-busy="true"><div className="skeleton" style={{ height: 240 }} /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
