import { Fragment, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, fmtDate, rupees } from '../../api';
import { STATUS_LABEL } from '../../site';
import { ErrorState, StatusBadge, useApi, useTitle } from '../../components/ui';
import { ProductForm, ProductList } from './AdminProducts';

const NEXT = {
  pending_payment: [['cancelled', 'Cancel']],
  placed: [['packed', 'Mark packed'], ['cancelled', 'Cancel']],
  packed: [['shipped', 'Mark shipped'], ['cancelled', 'Cancel']],
  shipped: [['delivered', 'Mark delivered']],
  delivered: [],
  cancelled: [],
};

function Dashboard() {
  useTitle('Admin');
  const { data, error, loading, reload } = useApi('/admin/stats');
  if (loading) return <div className="skeleton" style={{ height: 200 }} aria-busy="true" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const s = data.ordersByStatus;
  return (
    <>
      <div className="stats">
        <div className="stat"><b>{rupees(data.last7Days.revenue)}</b><span>Revenue, last 7 days</span></div>
        <div className="stat"><b>{data.last7Days.orders}</b><span>Orders, last 7 days</span></div>
        <div className="stat"><b>{(s.placed || 0) + (s.packed || 0)}</b><span>To pack or ship</span></div>
        <div className="stat"><b>{data.customers}</b><span>Customers</span></div>
      </div>
      <div className="two-col">
        <section className="panel" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Low stock</h3>
          {data.lowStock.length === 0 ? <p className="muted">Nothing running low.</p> : (
            <div className="table-wrap"><table><tbody>
              {data.lowStock.map((p) => (
                <tr key={p.id}><td><NavLink to={`/admin/products/${p.id}`} className="link-more">{p.title}</NavLink></td><td style={{ textAlign: 'right' }}><span className={`badge ${p.stock === 0 ? 'badge-danger' : 'badge-warn'}`}>{p.stock === 0 ? 'Sold out' : `${p.stock} left`}</span></td></tr>
              ))}
            </tbody></table></div>
          )}
        </section>
        <section className="panel">
          <h3 style={{ marginBottom: 8 }}>Orders by status</h3>
          {Object.keys(s).length === 0 ? <p className="muted">No orders yet.</p> : Object.entries(s).map(([k, v]) => <div className="sum-row" key={k}><span>{STATUS_LABEL[k] || k}</span><b>{v}</b></div>)}
        </section>
      </div>
    </>
  );
}

function OrderRows() {
  useTitle('Admin orders');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const { data, error, loading, reload } = useApi(`/admin/orders?page=${page}${status ? `&status=${status}` : ''}`);

  const move = async (o, next) => {
    const warn = next === 'cancelled' && o.paymentStatus === 'paid' ? ' This order is already paid online: refund it in the Razorpay dashboard.' : '';
    if (next === 'cancelled' && !window.confirm(`Cancel order ${o.orderNumber}? Stock will be returned.${warn}`)) return;
    try {
      await api(`/admin/orders/${o.id}`, { method: 'PATCH', body: { status: next } });
      toast.success(`Order ${STATUS_LABEL[next].toLowerCase()}`);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <label className="sr-only" htmlFor="st">Filter by status</label>
        <select id="st" className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {data && <span className="muted">{data.total} orders</span>}
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <div className="skeleton" style={{ height: 200 }} aria-busy="true" />}
      {data && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.items.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 32 }}>No orders here yet.</td></tr>}
              {data.items.map((o) => (
                <Fragment key={o.id}>
                  <tr>
                    <td><button className="btn btn-sm btn-quiet" onClick={() => setOpen(open === o.id ? null : o.id)} aria-expanded={open === o.id}>{o.orderNumber}</button></td>
                    <td>{o.user?.name}<div className="muted" style={{ fontSize: '.85rem' }}>{o.user?.email}</div></td>
                    <td>{fmtDate(o.createdAt)}</td>
                    <td>{rupees(o.total)}</td>
                    <td>{o.paymentMethod === 'cod' ? 'COD' : 'Online'}<div><span className={`badge ${o.paymentStatus === 'paid' ? 'badge-ok' : ''}`}>{o.paymentStatus}</span></div></td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><div className="row-actions">{NEXT[o.status].map(([n, label]) => <button key={n} className={`btn btn-sm ${n === 'cancelled' ? 'btn-danger' : 'btn-primary'}`} onClick={() => move(o, n)}>{label}</button>)}</div></td>
                  </tr>
                  {open === o.id && (
                    <tr>
                      <td colSpan={7} style={{ background: 'var(--bg)' }}>
                        <div className="form-grid two">
                          <div>{o.items.map((i) => <div key={i.product}>{i.qty} x {i.title} <span className="muted">({rupees(i.price)})</span></div>)}</div>
                          <address style={{ fontStyle: 'normal' }}>{o.address.name}, {o.address.phone}<br />{o.address.line1}{o.address.line2 && `, ${o.address.line2}`}<br />{o.address.city}, {o.address.state} {o.address.pincode}</address>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.pages > 1 && (
        <div className="pager">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span style={{ alignSelf: 'center' }}>Page {page} of {data.pages}</span>
          <button className="btn btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}

export default function Admin() {
  const link = ({ isActive }) => (isActive ? 'active' : undefined);
  return (
    <div className="container page">
      <h1 style={{ fontSize: '2.4rem', marginBottom: 14 }}>Admin</h1>
      <nav className="admin-nav" aria-label="Admin">
        <NavLink to="/admin" end className={link}>Dashboard</NavLink>
        <NavLink to="/admin/products" className={link}>Products</NavLink>
        <NavLink to="/admin/orders" className={link}>Orders</NavLink>
      </nav>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<ProductList />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="orders" element={<OrderRows />} />
      </Routes>
    </div>
  );
}
