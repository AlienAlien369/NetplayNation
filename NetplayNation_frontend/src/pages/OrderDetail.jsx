import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle } from '@phosphor-icons/react';
import { api, fmtDate, payOrder, rupees } from '../api';
import { useAuth } from '../state';
import { ErrorState, ProductImage, StatusBadge, useApi, useTitle } from '../components/ui';

const STEPS = [['placed', 'Placed'], ['packed', 'Packed'], ['shipped', 'Shipped'], ['delivered', 'Delivered']];

export default function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi(`/orders/${id}`);
  const [busy, setBusy] = useState(false);
  useTitle(data ? `Order ${data.order.orderNumber}` : 'Order');

  if (loading && !data) return <div className="container page" aria-busy="true"><div className="skeleton" style={{ height: 320 }} /></div>;
  if (error) return <div className="container page">{error.status === 404 ? <div className="empty"><h1>Order not found</h1><Link className="btn btn-primary" to="/orders">My orders</Link></div> : <ErrorState error={error} onRetry={reload} />}</div>;

  const { order: o, payment } = data;
  const reached = STEPS.findIndex(([s]) => s === o.status);
  const placedNow = params.get('placed') === '1' && o.status !== 'pending_payment' && o.status !== 'cancelled';
  const canCancel = o.status === 'pending_payment' || (o.status === 'placed' && o.paymentStatus !== 'paid');

  const run = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast.success(okMsg); reload(); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="container page page-enter">
      {placedNow && (
        <div className="success">
          <CheckCircle size={56} weight="fill" />
          <h1 style={{ fontSize: '2.4rem' }}>Thank you, your order is placed</h1>
          <p className="muted">You can follow its progress on this page and in My orders.</p>
        </div>
      )}
      <div className="line-row" style={{ marginBottom: 6 }}>
        <div><h2>Order {o.orderNumber}</h2><span className="muted">Placed on {fmtDate(o.createdAt)}</span></div>
        <StatusBadge status={o.status} />
      </div>

      {o.status === 'pending_payment' && payment && (
        <div className="alert alert-warn" style={{ margin: '14px 0', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>Payment is pending. Your items are held for a short time.</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => run(async () => { if (await payOrder(o, payment, user.email) === 'paid') toast.success('Payment received'); })}>Pay {rupees(o.total)}</button>
          </span>
        </div>
      )}

      {o.status !== 'cancelled' && o.status !== 'pending_payment' && (
        <div className="steps" aria-label="Order progress">
          {STEPS.map(([s, label], i) => <div key={s} className={`step ${i <= reached ? 'done' : ''}`}><i />{label}</div>)}
        </div>
      )}

      <div className="two-col" style={{ marginTop: 18 }}>
        <section className="panel" aria-label="Items">
          {o.items.map((i) => (
            <div className="line" key={i.product} style={{ gridTemplateColumns: '64px 1fr auto', alignItems: 'center' }}>
              <div className="line-img" style={{ width: 64, height: 64 }}><ProductImage product={{ title: i.title, images: i.image ? [i.image] : [] }} size="sm" /></div>
              <div><div className="line-title">{i.title}</div><span className="muted">Qty {i.qty} at {rupees(i.price)}</span></div>
              <b>{rupees(i.price * i.qty)}</b>
            </div>
          ))}
        </section>
        <aside className="panel" aria-label="Order details">
          <div className="sum-row"><span>Subtotal</span><span>{rupees(o.subtotal)}</span></div>
          <div className="sum-row"><span>Shipping</span><span>{o.shipping === 0 ? 'Free' : rupees(o.shipping)}</span></div>
          <div className="sum-row sum-total"><span>Total</span><span>{rupees(o.total)}</span></div>
          <p className="muted" style={{ marginTop: 12 }}>{o.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online payment'}: {o.paymentStatus === 'paid' ? 'paid' : 'pending'}</p>
          <h3 style={{ marginTop: 18, fontSize: '1.1rem' }}>Delivering to</h3>
          <address style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
            {o.address.name}<br />{o.address.line1}{o.address.line2 && <>, {o.address.line2}</>}<br />{o.address.city}, {o.address.state} {o.address.pincode}<br />{o.address.phone}
          </address>
          {canCancel && (
            <button className="btn btn-danger btn-block" style={{ marginTop: 18 }} disabled={busy} onClick={() => window.confirm('Cancel this order?') && run(() => api(`/orders/${o.id}/cancel`, { method: 'POST' }), 'Order cancelled')}>Cancel order</button>
          )}
          {!canCancel && o.status !== 'cancelled' && o.status !== 'delivered' && <p className="muted" style={{ marginTop: 14, fontSize: '.9rem' }}>Need to change something? Email us with your order number.</p>}
        </aside>
      </div>
      <p style={{ marginTop: 24 }}><Link to="/orders" className="link-more">Back to my orders</Link></p>
    </div>
  );
}
