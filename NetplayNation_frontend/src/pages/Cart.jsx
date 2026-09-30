import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShoppingCartSimple, Trash } from '@phosphor-icons/react';
import { api, rupees } from '../api';
import { useCart } from '../state';
import { ErrorState, ProductImage, Qty, useTitle } from '../components/ui';

// Fetches live prices for the cart and reconciles the stored cart with what is actually available.
export function useQuote() {
  const { items, setQty, remove } = useCart();
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const key = JSON.stringify(items);

  useEffect(() => {
    if (!items.length) { setQuote({ lines: [], subtotal: 0, shipping: 0, total: 0 }); return; }
    let live = true;
    api('/cart/quote', { method: 'POST', body: { items: items.map((i) => ({ productId: i.id, qty: i.qty })) } })
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
          <div className="sum-row"><span>Shipping</span><span>{quote.shipping === 0 ? 'Free' : rupees(quote.shipping)}</span></div>
          <div className="sum-row sum-total"><span>Total</span><span>{rupees(quote.total)}</span></div>
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

