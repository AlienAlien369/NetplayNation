import { Link } from 'react-router-dom';
import { ArrowRight, CreditCard, Money, ArrowsClockwise, Truck } from '@phosphor-icons/react';
import { rupees } from '../api';
import { categoryIcon } from '../site';
import ProductCard from '../components/ProductCard';
import { ErrorState, ProductSkeletons, useApi, useTitle } from '../components/ui';

function ProductRow({ path, cols4 }) {
  const { data, error, loading, reload } = useApi(path);
  if (loading) return <ProductSkeletons count={4} cols4={cols4} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data.items.length) return null;
  return <div className={`grid-products ${cols4 ? 'cols-4' : ''}`}>{data.items.map((p) => <ProductCard key={p.id} product={p} />)}</div>;
}

export default function Home() {
  useTitle();
  const facets = useApi('/facets');
  const cfg = useApi('/config');
  const tiles = (facets.data?.categories || []).slice().sort((a, b) => b.count - a.count).slice(0, 4);
  const freeOver = cfg.data?.freeShippingOver;

  return (
    <div className="page-enter">
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <h1>Gear up. <em>Level up.</em></h1>
            <p className="lead">Rackets, bats, boots and fitness gear from trusted brands, delivered across India.</p>
            <div className="hero-cta">
              <Link to="/shop" className="btn btn-primary btn-lg">Shop all gear <ArrowRight size={20} weight="bold" /></Link>
            </div>
          </div>
          <nav className="sport-tiles" aria-label="Shop by sport">
            {facets.loading && Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton" style={{ minHeight: 150 }} />)}
            {tiles.map((c) => {
              const Icon = categoryIcon(c.name);
              return (
                <Link key={c.name} to={`/shop?category=${encodeURIComponent(c.name)}`} className="tile">
                  <Icon size={40} weight="duotone" />
                  <span>
                    <span className="tile-name">{c.name}</span>
                    <br />
                    <span className="tile-count">{c.count} {c.count === 1 ? 'product' : 'products'}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 8 }}>
        <div className="container">
          <div className="section-head">
            <h2>Featured gear</h2>
            <Link to="/shop" className="link-more">View all <ArrowRight size={16} weight="bold" /></Link>
          </div>
          <ProductRow path="/products?featured=1&limit=4" cols4 />
        </div>
      </section>

      <section className="trust" aria-label="Why shop with us">
        <div className="container trust-grid">
          <div className="trust-item"><Truck size={30} /><div><b>{freeOver ? `Free shipping over ${rupees(freeOver)}` : 'Free shipping on bigger orders'}</b><span>Tracked delivery across India</span></div></div>
          <div className="trust-item"><Money size={30} /><div><b>Cash on delivery</b><span>Pay when your order arrives</span></div></div>
          <div className="trust-item"><CreditCard size={30} /><div><b>Secure online payment</b><span>UPI, cards and net banking</span></div></div>
          <div className="trust-item"><ArrowsClockwise size={30} /><div><b>7-day returns</b><span>For unused items in original packaging</span></div></div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>New arrivals</h2>
            <Link to="/shop?sort=new" className="link-more">Browse the shop <ArrowRight size={16} weight="bold" /></Link>
          </div>
          <ProductRow path="/products?sort=new&limit=8" cols4 />
        </div>
      </section>
    </div>
  );
}
