import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CreditCard, Money, WarningCircle } from '@phosphor-icons/react';
import { api, getConfig, payOrder, rupees } from '../api';
import { useAuth, useCart } from '../state';
import { STATES } from '../site';
import { Field, ProductImage, useTitle } from '../components/ui';
import { CouponBox, useQuote } from './Cart';

const ADDR_KEY = 'np_addr_v1';
const blank = { name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

const validate = (a) => {
  const e = {};
  if (a.name.trim().length < 2) e.name = 'Enter the recipient name';
  if (!/^[6-9]\d{9}$/.test(a.phone.trim())) e.phone = 'Enter a 10-digit mobile number';
  if (a.line1.trim().length < 3) e.line1 = 'Enter the address';
  if (a.city.trim().length < 2) e.city = 'Enter the city';
  if (!a.state) e.state = 'Choose the state';
  if (!/^[1-9]\d{5}$/.test(a.pincode.trim())) e.pincode = 'Enter a 6-digit pincode';
  return e;
};

export default function Checkout() {
  useTitle('Checkout');
  const { user } = useAuth();
  const { clear } = useCart();
  const { quote, error: quoteError, items } = useQuote();
  const nav = useNavigate();
  const [cfg, setCfg] = useState(null);
  const [addr, setAddr] = useState(() => {
    try { return { ...blank, name: user?.name || '', ...JSON.parse(localStorage.getItem(ADDR_KEY)) }; } catch { return { ...blank, name: user?.name || '' }; }
  });
  const [errors, setErrors] = useState({});
  const [method, setMethod] = useState('cod');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { getConfig().then(setCfg).catch(() => setCfg({ razorpayKeyId: null })); }, []);
  useEffect(() => { if (cfg?.razorpayKeyId) setMethod('razorpay'); }, [cfg]);

  const change = (k, value) => {
    setAddr((a) => ({ ...a, [k]: value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };
  const set = (k) => (e) => change(k, e.target.value);
  const online = Boolean(cfg?.razorpayKeyId);

  if (!items.length) {
    return (
      <div className="container page empty">
        <h1>Your cart is empty</h1>
        <Link className="btn btn-primary" to="/shop">Continue shopping</Link>
      </div>
    );
  }
  if (quoteError) return <div className="container page"><div className="alert alert-error">{quoteError.message}</div></div>;
  if (!quote) return <div className="container page" aria-busy="true"><div className="skeleton" style={{ height: 320 }} /></div>;

  const live = quote.lines.filter((l) => l.qty > 0);

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    const v = validate(addr);
    setErrors(v);
    if (Object.keys(v).length) {
      document.getElementById(Object.keys(v)[0])?.focus();
      return;
    }
    setBusy(true);
    try {
      const address = Object.fromEntries(Object.entries(addr).map(([k, val]) => [k, val.trim()]));
      const res = await api('/orders', {
        method: 'POST',
        body: { items: items.map((i) => ({ productId: i.id, qty: i.qty })), address, paymentMethod: method, couponCode: quote.couponCode || undefined },
      });
      try { localStorage.setItem(ADDR_KEY, JSON.stringify(address)); } catch { /* ignore */ }
      clear(); // the cart now belongs to the order
      if (method === 'cod') return nav(`/orders/${res.order.id}?placed=1`);
      const outcome = await payOrder(res.order, res.payment, user.email);
      if (outcome === 'dismissed') toast('Payment not completed. You can pay from this page.');
      nav(`/orders/${res.order.id}${outcome === 'paid' ? '?placed=1' : ''}`);
    } catch (err) {
      setFormError(err.message);
      setBusy(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="container page page-enter">
      <h1 style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 3rem)', marginBottom: 20 }}>Checkout</h1>
      <form className="two-col" onSubmit={submit} noValidate>
        <div className="stack" style={{ display: 'grid', gap: 20 }}>
          {formError && <div className="alert alert-error" role="alert"><WarningCircle size={20} style={{ flex: 'none' }} />{formError}</div>}
          <section className="panel">
            <h2 style={{ fontSize: '1.5rem', marginBottom: 14 }}>Delivery address</h2>
            <div className="form-grid two">
              <Field id="name" label="Full name" error={errors.name}><input id="name" className="input" autoComplete="name" value={addr.name} onChange={set('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-err' : undefined} /></Field>
              <Field id="phone" label="Mobile number" error={errors.phone}><input id="phone" className="input" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={addr.phone} onChange={(e) => change('phone', e.target.value.replace(/\D/g, ''))} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'phone-err' : undefined} /></Field>
              <Field id="line1" label="Address" error={errors.line1} className="span-2"><input id="line1" className="input" autoComplete="address-line1" placeholder="House number, street, area" value={addr.line1} onChange={set('line1')} aria-invalid={!!errors.line1} aria-describedby={errors.line1 ? 'line1-err' : undefined} /></Field>
              <Field id="line2" label="Landmark (optional)" className="span-2"><input id="line2" className="input" autoComplete="address-line2" value={addr.line2} onChange={set('line2')} /></Field>
              <Field id="city" label="City" error={errors.city}><input id="city" className="input" autoComplete="address-level2" value={addr.city} onChange={set('city')} aria-invalid={!!errors.city} aria-describedby={errors.city ? 'city-err' : undefined} /></Field>
              <Field id="pincode" label="Pincode" error={errors.pincode}><input id="pincode" className="input" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={addr.pincode} onChange={(e) => change('pincode', e.target.value.replace(/\D/g, ''))} aria-invalid={!!errors.pincode} aria-describedby={errors.pincode ? 'pincode-err' : undefined} /></Field>
              <Field id="state" label="State" error={errors.state} className="span-2">
                <select id="state" className="select" autoComplete="address-level1" value={addr.state} onChange={set('state')} aria-invalid={!!errors.state} aria-describedby={errors.state ? 'state-err' : undefined}>
                  <option value="">Choose a state</option>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </section>

          <section className="panel">
            <h2 style={{ fontSize: '1.5rem', marginBottom: 14 }}>Payment</h2>
            <div style={{ display: 'grid', gap: 10 }} role="radiogroup" aria-label="Payment method">
              <label className="radio-card" aria-disabled={!online}>
                <input type="radio" name="pay" value="razorpay" disabled={!online} checked={method === 'razorpay'} onChange={() => setMethod('razorpay')} />
                <div><b style={{ display: 'flex', gap: 8, alignItems: 'center' }}><CreditCard size={20} /> Pay online</b><span className="muted">{online ? 'UPI, cards and net banking. Secured by Razorpay.' : 'Not available right now.'}</span></div>
              </label>
              <label className="radio-card">
                <input type="radio" name="pay" value="cod" checked={method === 'cod'} onChange={() => setMethod('cod')} />
                <div><b style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Money size={20} /> Cash on delivery</b><span className="muted">Pay in cash when your order arrives.</span></div>
              </label>
            </div>
          </section>
        </div>

        <aside className="panel sticky" aria-label="Order summary">
          <h2 style={{ fontSize: '1.5rem', marginBottom: 10 }}>Order summary</h2>
          <div>
            {live.map((l) => (
              <div className="line" key={l.id} style={{ gridTemplateColumns: '56px 1fr auto', padding: '10px 0', alignItems: 'center' }}>
                <div className="line-img" style={{ width: 56, height: 56 }}><ProductImage product={l} size="sm" /></div>
                <div style={{ minWidth: 0 }}><div className="line-title" style={{ fontSize: '.95rem' }}>{l.title}</div><span className="muted">Qty {l.qty}</span></div>
                <b>{rupees(l.price * l.qty)}</b>
              </div>
            ))}
          </div>
          <div className="sum-row" style={{ marginTop: 8 }}><span>Subtotal</span><span>{rupees(quote.subtotal)}</span></div>
          {quote.discount > 0 && <div className="sum-row" style={{ color: 'var(--ok)' }}><span>Discount ({quote.couponCode})</span><span>-{rupees(quote.discount)}</span></div>}
          <div className="sum-row"><span>Shipping</span><span>{quote.shipping === 0 ? 'Free' : rupees(quote.shipping)}</span></div>
          <div className="sum-row sum-total"><span>Total</span><span>{rupees(quote.total)}</span></div>
          <div style={{ marginTop: 14 }}><CouponBox quote={quote} /></div>
          <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 18 }} disabled={busy || !live.length}>
            {busy ? 'Placing order' : method === 'cod' ? 'Place order' : `Pay ${rupees(quote.total)}`}
          </button>
          <p className="muted" style={{ marginTop: 10, fontSize: '.9rem' }}>By placing your order you agree to our <Link to="/policies/terms" className="link-more">terms</Link> and <Link to="/policies/returns" className="link-more">returns policy</Link>.</p>
        </aside>
      </form>
    </div>
  );
}
