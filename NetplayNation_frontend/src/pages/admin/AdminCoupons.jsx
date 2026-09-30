import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, WarningCircle } from '@phosphor-icons/react';
import { api, fmtDate, rupees } from '../../api';
import { ErrorState, Field, useApi, useTitle } from '../../components/ui';

const describe = (c) => (c.type === 'percent' ? `${c.value}% off${c.maxDiscount ? `, up to ${rupees(c.maxDiscount)}` : ''}` : `${rupees(c.value)} off`);
const expired = (c) => c.expiresAt && new Date(c.expiresAt) < new Date();

export function CouponList() {
  useTitle('Admin coupons');
  const { data, error, loading, reload } = useApi('/admin/coupons');

  const remove = async (c) => {
    if (!window.confirm(`Delete coupon ${c.code}? Orders that used it keep their discount.`)) return;
    try { await api(`/admin/coupons/${c.id}`, { method: 'DELETE' }); toast.success('Coupon deleted'); reload(); } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
        <p className="muted">Customers enter these codes in the cart or at checkout.</p>
        <Link to="/admin/coupons/new" className="btn btn-primary"><Plus size={18} weight="bold" /> Add coupon</Link>
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <div className="skeleton" style={{ height: 160 }} aria-busy="true" />}
      {data && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Discount</th><th>Minimum order</th><th>Used</th><th>Expires</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.items.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 32 }}>No coupons yet. Create one to run a promotion.</td></tr>}
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.code}</b>{c.description && <div className="muted" style={{ fontSize: '.85rem' }}>{c.description}</div>}</td>
                  <td>{describe(c)}</td>
                  <td>{c.minSubtotal ? rupees(c.minSubtotal) : 'None'}</td>
                  <td>{c.usedCount}{c.usageLimit ? ` of ${c.usageLimit}` : ''}</td>
                  <td>{c.expiresAt ? fmtDate(c.expiresAt) : 'Never'}</td>
                  <td>{!c.active ? <span className="badge">Off</span> : expired(c) ? <span className="badge badge-danger">Expired</span> : <span className="badge badge-ok">Live</span>}</td>
                  <td><div className="row-actions"><Link className="btn btn-sm" to={`/admin/coupons/${c.id}`}>Edit</Link><button className="btn btn-sm btn-danger" onClick={() => remove(c)}>Delete</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const empty = { code: '', description: '', type: 'percent', value: '', minSubtotal: '', maxDiscount: '', expiresAt: '', usageLimit: '', perUserLimit: 1, active: true };

export function CouponForm() {
  const { id } = useParams();
  const nav = useNavigate();
  useTitle(id ? 'Edit coupon' : 'Add coupon');
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api('/admin/coupons')
      .then(({ items }) => {
        const c = items.find((x) => x.id === id);
        if (!c) return setError('Coupon not found');
        setForm({ ...empty, ...c, minSubtotal: c.minSubtotal || '', maxDiscount: c.maxDiscount || '', usageLimit: c.usageLimit || '', expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '' });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const num = (v) => (v === '' ? null : Number(v));
    const body = {
      code: form.code, description: form.description, type: form.type, value: Number(form.value),
      minSubtotal: Number(form.minSubtotal || 0), maxDiscount: form.type === 'percent' ? num(form.maxDiscount) : null,
      expiresAt: form.expiresAt || null, usageLimit: num(form.usageLimit), perUserLimit: Number(form.perUserLimit || 1), active: form.active,
    };
    try {
      await api(id ? `/admin/coupons/${id}` : '/admin/coupons', { method: id ? 'PUT' : 'POST', body });
      toast.success(id ? 'Coupon updated' : 'Coupon created');
      nav('/admin/coupons');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (loading) return <div className="skeleton" style={{ height: 260 }} aria-busy="true" />;

  return (
    <form className="panel" onSubmit={submit} style={{ maxWidth: 780 }}>
      <h2 style={{ marginBottom: 16 }}>{id ? 'Edit coupon' : 'Add coupon'}</h2>
      {error && <div className="alert alert-error" role="alert" style={{ marginBottom: 16 }}><WarningCircle size={20} style={{ flex: 'none' }} />{error}</div>}
      <div className="form-grid two">
        <Field id="code" label="Code" hint="3 to 20 letters, numbers, - or _"><input id="code" className="input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={20} /></Field>
        <Field id="description" label="Note for you (optional)"><input id="description" className="input" maxLength={140} value={form.description} onChange={set('description')} /></Field>
        <Field id="type" label="Type">
          <select id="type" className="select" value={form.type} onChange={set('type')}>
            <option value="percent">Percentage off</option>
            <option value="flat">Flat amount off (INR)</option>
          </select>
        </Field>
        <Field id="value" label={form.type === 'percent' ? 'Percent off' : 'Rupees off'}><input id="value" className="input" type="number" min="1" max={form.type === 'percent' ? 100 : undefined} step="1" required value={form.value} onChange={set('value')} /></Field>
        <Field id="minSubtotal" label="Minimum order (INR, optional)"><input id="minSubtotal" className="input" type="number" min="0" step="1" value={form.minSubtotal} onChange={set('minSubtotal')} /></Field>
        {form.type === 'percent' ? (
          <Field id="maxDiscount" label="Maximum discount (INR, optional)"><input id="maxDiscount" className="input" type="number" min="1" step="1" value={form.maxDiscount} onChange={set('maxDiscount')} /></Field>
        ) : <div />}
        <Field id="expiresAt" label="Valid until (optional)" hint="Through the end of that day"><input id="expiresAt" className="input" type="date" value={form.expiresAt} onChange={set('expiresAt')} /></Field>
        <Field id="usageLimit" label="Total uses allowed (optional)"><input id="usageLimit" className="input" type="number" min="1" step="1" value={form.usageLimit} onChange={set('usageLimit')} /></Field>
        <Field id="perUserLimit" label="Uses per customer"><input id="perUserLimit" className="input" type="number" min="1" step="1" value={form.perUserLimit} onChange={set('perUserLimit')} /></Field>
        <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={form.active} onChange={set('active')} /> Active</label>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving' : 'Save coupon'}</button>
        <Link className="btn" to="/admin/coupons">Cancel</Link>
      </div>
    </form>
  );
}
