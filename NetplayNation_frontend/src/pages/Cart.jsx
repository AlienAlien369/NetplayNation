import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShoppingCartSimple, Tag, Trash } from '@phosphor-icons/react';
import { api, rupees } from '../api';
import { useAuth, useCart } from '../state';
import { ErrorState, ProductImage, Qty, useTitle } from '../components/ui';

// Fetches live prices for the cart and reconciles the stored cart with what is actually available.
export function useQuote() {
  const { items, setQty, remove, coupon } = useCart();
  const { user } = useAuth();
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const key = JSON.stringify([items, coupon, user?.id]);

  useEffect(() => {
    if (!items.length) { setQuote({ lines: [], subtotal: 0, shipping: 0, discount: 0, total: 0 }); return; }
    let live = true;
    api('/cart/quote', { method: 'POST', body: { items: items.map((i) => ({ productId: i.id, qty: i.qty })), coupon: coupon || undefined } })
      .then((q) => {
        if (!live) return;
        setError(null);
        setQuote(q);
        const byId = new Map(q.lines.map((l) => [l.id, l]));
        for (const it of items) {
          const l = byId.get(it.id);
          if (!l || l.qty === 0) { remove(it.id); toast(`${l ? l.title : 'An item'} is no longer available and was removed.`); }
          else if (l.qty < it.qty) { setQty(it.id, l.qty); toast(`Only ${l.qty} of ${l.title} in stock. We updated your cart.`); }
        }
      })
      .catch((e) => live && setError(e));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { quote, error, items };
}

export function CouponBox({ quote }) {
  const { coupon, setCoupon } = useCart();
  const [input, setInput] = useState(coupon);
  if (quote.couponCode) {
    return (
      <div className="coupon-applied">
        <span><Tag size={18} /> <b>{quote.couponCode}</b> applied</span>
        <button type="button" className="btn btn-sm btn-quiet" onClick={() => { setCoupon(''); setInput(''); }}>Remove</button>
      </div>
    );
  }
  const apply = () => {
    const code = input.trim().toUpperCase();
    if (code) setCoupon(code);
  };
  // A div, not a form: the coupon box also renders inside the checkout form.
  return (
    <div className="coupon">
      <label htmlFor="coupon">Coupon code</label>
      <div className="coupon-row">
        <input
          id="coupon"
          className="input"
          value={input}
          maxLength={20}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
          aria-invalid={Boolean(coupon && quote.couponError)}
          aria-describedby={coupon && quote.couponError ? 'coupon-err' : undefined}
        />
        <button type="button" className="btn" onClick={apply}>Apply</button>
      </div>
      {coupon && quote.couponError && <span className="field-error" id="coupon-err" role="alert">{quote.couponError}</span>}
    </div>
  );
}

export default function Cart() {
  useTitle('Your cart');
  const { quote, error } = useQuote();
  const { setQty, remove, items } = useCart();

  if (error) return <div className="container page"><ErrorState error={error} onRetry={() => window.location.reload()} /></div>;
  if (!quote) return <div className="container page" aria-busy="true"><div className="skeleton" style={{ height: 260 }} /></div>;

  if (!items.length || !quote.lines.length) {
    return (
      <div className="container page empty">
        <ShoppingCartSimple size={56} />
        <h1>Your cart is empty</h1>
        <p className="muted">Add a racket, a ball or a pair of shoes to get started.</p>
        <Link className="btn btn-primary btn-lg" to="/shop">Start shopping</Link>
      </div>
    );
  }

  const left = Math.max(0, quote.freeShippingOver - quote.subtotal);
  const pct = Math.min(100, Math.round((quote.subtotal / quote.freeShippingOver) * 100));
  const live = quote.lines.filter((l) => l.qty > 0);

  return (
    <div className="container page page-enter">
      <h1 style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 3rem)', marginBottom: 20 }}>Your cart</h1>
      <div className="two-col">
        <section className="panel" aria-label="Cart items">
          {live.map((l) => (
            <div className="line" key={l.id}>
              <Link to={`/product/${l.slug}`} className="line-img"><ProductImage product={l} size="sm" /></Link>
              <div className="line-main">
                <Link to={`/product/${l.slug}`} className="line-title">{l.title}</Link>
                <span className="muted">{l.brand}</span>
                <div className="line-row">
                  <Qty value={l.qty} max={Math.min(l.stock, 10)} onChange={(v) => setQty(l.id, v)} label={`Quantity for ${l.title}`} />
                  <div style={{ textAlign: 'right' }}>
                    <b>{rupees(l.price * l.qty)}</b>
                    {l.qty > 1 && <div className="muted" style={{ fontSize: '.85rem' }}>{rupees(l.price)} each</div>}
                  </div>
                </div>
                <div><button className="btn btn-sm btn-quiet" onClick={() => remove(l.id)} aria-label={`Remove ${l.title}`}><Trash size={16} /> Remove</button></div>
              </div>
            </div>
          ))}
        </section>

        <aside className="panel sticky" aria-label="Order summary">
          <h2 style={{ fontSize: '1.5rem', marginBottom: 10 }}>Order summary</h2>
          <div className="sum-row"><span>Subtotal</span><span>{rupees(quote.subtotal)}</span></div>
          {quote.discount > 0 && <div className="sum-row" style={{ color: 'var(--ok)' }}><span>Discount ({quote.couponCode})</span><span>-{rupees(quote.discount)}</span></div>}
          <div className="sum-row"><span>Shipping</span><span>{quote.shipping === 0 ? 'Free' : rupees(quote.shipping)}</span></div>
          <div className="sum-row sum-total"><span>Total</span><span>{rupees(quote.total)}</span></div>
          <div style={{ marginTop: 14 }}><CouponBox quote={quote} /></div>
          {left > 0 ? (
            <div style={{ marginTop: 14 }}>
              <span className="muted">Add {rupees(left)} more for free shipping</span>
              <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
            </div>
          ) : (
            <p className="badge badge-ok" style={{ marginTop: 14 }}>You get free shipping</p>
          )}
          <Link to="/checkout" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 18 }}>Checkout</Link>
          <Link to="/shop" className="btn btn-quiet btn-block" style={{ marginTop: 8 }}>Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}

