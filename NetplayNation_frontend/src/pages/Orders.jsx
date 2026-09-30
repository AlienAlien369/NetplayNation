import { Link } from 'react-router-dom';
import { Package } from '@phosphor-icons/react';
import { fmtDate, rupees } from '../api';
import { ErrorState, StatusBadge, useApi, useTitle } from '../components/ui';

export default function Orders() {
  useTitle('My orders');
  const { data, error, loading, reload } = useApi('/orders');

  return (
    <div className="container page page-enter">
      <h1 style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 3rem)', marginBottom: 20 }}>My orders</h1>
      {loading && <div className="skeleton" style={{ height: 120 }} aria-busy="true" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.orders.length === 0 && (
        <div className="empty">
          <Package size={56} />
          <h2>No orders yet</h2>
          <p className="muted">When you place an order it will show up here.</p>
          <Link to="/shop" className="btn btn-primary">Start shopping</Link>
        </div>
      )}
      {data?.orders.map((o) => (
        <Link to={`/orders/${o.id}`} className="order-row" key={o.id}>
          <div className="line-row">
            <b>{o.orderNumber}</b>
            <StatusBadge status={o.status} />
          </div>
          <div className="line-row muted">
            <span>{fmtDate(o.createdAt)} &middot; {o.items.reduce((s, i) => s + i.qty, 0)} items</span>
            <b style={{ color: 'var(--ink)' }}>{rupees(o.total)}</b>
          </div>
          <span className="muted">{o.items.map((i) => i.title).join(', ')}</span>
        </Link>
      ))}
    </div>
  );
}
