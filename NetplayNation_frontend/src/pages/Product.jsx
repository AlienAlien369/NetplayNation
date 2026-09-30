import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowsClockwise, CreditCard, Money, Truck } from '@phosphor-icons/react';
import { rupees } from '../api';
import { useCart } from '../state';
import ProductCard from '../components/ProductCard';
import { ErrorState, Price, ProductImage, Qty, useApi, useTitle } from '../components/ui';

export default function Product() {
  const { slug } = useParams();
  const { data, error, loading, reload } = useApi(`/products/${slug}`);
  const { add } = useCart();
  const nav = useNavigate();
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const p = data?.product;

  useTitle(p?.title, p ? `${p.title} by ${p.brand}. ${rupees(p.price)} with cash on delivery and secure online payment.` : undefined);
  useEffect(() => { setQty(1); setImg(0); }, [slug]);

  if (loading) {
    return (
      <div className="container page" aria-busy="true">
        <div className="pdp"><div className="skeleton" style={{ aspectRatio: '1/1' }} /><div style={{ display: 'grid', gap: 14 }}><div className="skeleton" style={{ height: 20, width: '30%' }} /><div className="skeleton" style={{ height: 56 }} /><div className="skeleton" style={{ height: 40, width: '40%' }} /></div></div>
      </div>
    );
  }
  if (error?.status === 404) {
    return (
      <div className="container page empty">
        <h1>Product not found</h1>
        <p className="muted">It may have been removed or the link is incorrect.</p>
        <Link className="btn btn-primary" to="/shop">Back to the shop</Link>
      </div>
    );
  }
  if (error) return <div className="container page"><ErrorState error={error} onRetry={reload} /></div>;

  const soldOut = p.stock <= 0;
  const max = Math.min(p.stock, 10);
  const images = p.images.length ? p.images : [null];

  return (
    <div className="container page page-enter">
      <div className="crumbs">
        <Link to="/">Home</Link> / <Link to={`/shop?category=${encodeURIComponent(p.category)}`}>{p.category}</Link> / <span>{p.title}</span>
      </div>
      <div className="pdp">
        <div>
          <div className="gallery-main"><ProductImage product={{ ...p, images: images[img] ? [images[img]] : [] }} /></div>
          {p.images.length > 1 && (
            <div className="thumbs">
              {p.images.map((src, i) => (
                <button key={src} className="thumb" aria-current={i === img} aria-label={`Show image ${i + 1}`} onClick={() => setImg(i)}><img src={src} alt="" /></button>
              ))}
            </div>
          )}
        </div>
        <div className="pdp-info">
          <span className="card-brand">{p.brand}</span>
          <h1>{p.title}</h1>
          <Price price={p.price} mrp={p.mrp} size="lg" />
          <p className="muted" style={{ marginTop: 4 }}>Inclusive of all taxes</p>

          <div className="pdp-actions">
            {soldOut ? (
              <div className="alert alert-warn">This item is currently sold out.</div>
            ) : (
              <>
                {p.stock <= 5 && <span className="stock-note">Only {p.stock} left in stock</span>}
                <div className="buy-row" style={{ alignItems: 'center' }}>
                  <Qty value={qty} onChange={(v) => setQty(Math.max(1, Math.min(v, max)))} max={max} />
                </div>
                <div className="buy-row">
                  <button className="btn btn-primary btn-lg" onClick={() => { add(p.id, qty); toast.success('Added to cart'); }}>Add to cart</button>
                  <button className="btn btn-lg" onClick={() => { add(p.id, qty); nav('/checkout'); }}>Buy now</button>
                </div>
              </>
            )}
          </div>

          <div className="perks">
            <div><Truck size={22} /> Delivery in 3 to 7 business days</div>
            <div><Money size={22} /> Cash on delivery available</div>
            <div><CreditCard size={22} /> Pay securely with UPI or card</div>
            <div><ArrowsClockwise size={22} /> 7-day returns on unused items</div>
          </div>
          {p.description && <p className="desc">{p.description}</p>}
        </div>
      </div>

      {data.related.length > 0 && (
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="section-head"><h2>More in {p.category}</h2></div>
          <div className="grid-products cols-4">{data.related.map((r) => <ProductCard key={r.id} product={r} />)}</div>
        </section>
      )}
    </div>
  );
}
