import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Heart, Minus, Plus, Star, WarningCircle } from '@phosphor-icons/react';
import { api, rupees } from '../api';
import { useWishlist } from '../state';
import { categoryIcon, SITE, STATUS_LABEL } from '../site';

export function useTitle(title, description) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE.name}` : `${SITE.name} | Sports gear for every game`;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
}

// Loads a GET endpoint; refetches when `path` changes. Stale responses are ignored.
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((error) => live && setState({ data: null, error, loading: false }));
    return () => { live = false; };
  }, [path, tick]);
  return { ...state, reload: useCallback(() => setTick((t) => t + 1), []) };
}

export function ProductImage({ product, size = 'md' }) {
  const [failed, setFailed] = useState(false);
  const src = product.images?.[0] || product.image;
  if (src && !failed) return <img src={src} alt={product.title} loading="lazy" onError={() => setFailed(true)} />;
  const Icon = categoryIcon(product.category);
  return (
    <div className="placeholder" role="img" aria-label={product.title}>
      <Icon size={size === 'sm' ? 22 : 44} weight="duotone" />
      {size !== 'sm' && <span>{product.brand}</span>}
    </div>
  );
}

export const discountPct = (price, mrp) => (mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

export function Price({ price, mrp, size }) {
  const off = discountPct(price, mrp);
  return (
    <div className={`price ${size === 'lg' ? 'pdp-price' : ''}`}>
      <span className="price-now">{rupees(price)}</span>
      {off > 0 && (
        <>
          <span className="price-was" aria-label={`Original price ${rupees(mrp)}`}>{rupees(mrp)}</span>
          <span className="price-off">{off}% off</span>
        </>
      )}
    </div>
  );
}

export function Qty({ value, onChange, max = 10, label = 'Quantity' }) {
  return (
    <div className="qty" role="group" aria-label={label}>
      <button type="button" aria-label="Decrease quantity" onClick={() => onChange(value - 1)} disabled={value <= 1}><Minus size={16} /></button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label="Increase quantity" onClick={() => onChange(value + 1)} disabled={value >= max}><Plus size={16} /></button>
    </div>
  );
}

export function ProductSkeletons({ count = 8, cols4 = false }) {
  return (
    <div className={`grid-products ${cols4 ? 'cols-4' : ''}`} aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <div className="sk-card" key={i}>
          <div className="skeleton" style={{ aspectRatio: '1 / 1' }} />
          <div style={{ padding: 14, display: 'grid', gap: 10 }}>
            <div className="skeleton" style={{ height: 12, width: '40%' }} />
            <div className="skeleton" style={{ height: 16 }} />
            <div className="skeleton" style={{ height: 24, width: '50%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="empty" role="alert">
      <WarningCircle size={40} />
      <h2>Something went wrong</h2>
      <p className="muted">{error?.message || 'Please try again.'}</p>
      {onRetry && <button className="btn btn-primary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export const Field = ({ label, error, hint, children, id, className = '' }) => (
  <div className={`field ${className}`}>
    <label htmlFor={id}>{label}</label>
    {children}
    {hint && !error && <span className="field-hint">{hint}</span>}
    {error && <span className="field-error" id={`${id}-err`}>{error}</span>}
  </div>
);

const STATUS_TONE = { pending_payment: 'badge-warn', placed: '', packed: '', shipped: 'badge-ok', delivered: 'badge-ok', cancelled: 'badge-danger' };
export const StatusBadge = ({ status }) => <span className={`badge ${STATUS_TONE[status] || ''}`}>{STATUS_LABEL[status] || status}</span>;

export function Stars({ value, size = 16 }) {
  const full = Math.round(value);
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} weight={n <= full ? 'fill' : 'regular'} aria-hidden="true" />)}
    </span>
  );
}

export function RatingLine({ avg, count, size }) {
  if (!count) return null;
  return (
    <span className="rating-line">
      <Stars value={avg} size={size} />
      <span>{avg.toFixed(1)}</span>
      <span className="muted">({count})</span>
    </span>
  );
}

export function WishlistButton({ productId, title, className = '' }) {
  const wish = useWishlist();
  const nav = useNavigate();
  const { pathname, search } = useLocation();
  const saved = wish.has(productId);
  return (
    <button
      type="button"
      className={`heart ${saved ? 'on' : ''} ${className}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`}
      onClick={async (e) => {
        e.preventDefault();
        try {
          const now = await wish.toggle(productId);
          if (now === null) {
            toast('Sign in to save items to your wishlist');
            nav(`/login?next=${encodeURIComponent(pathname + search)}`);
          } else toast.success(now ? 'Saved to wishlist' : 'Removed from wishlist');
        } catch (err) {
          toast.error(err.message);
        }
      }}
    >
      <Heart size={22} weight={saved ? 'fill' : 'regular'} />
    </button>
  );
}
