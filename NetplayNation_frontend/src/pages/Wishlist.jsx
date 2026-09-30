import { Link } from 'react-router-dom';
import { Heart } from '@phosphor-icons/react';
import { useWishlist } from '../state';
import ProductCard from '../components/ProductCard';
import { ErrorState, ProductSkeletons, useApi, useTitle } from '../components/ui';

export default function Wishlist() {
  useTitle('My wishlist');
  const wish = useWishlist();
  const { data, error, loading, reload } = useApi('/wishlist');
  // Items un-hearted on this page disappear immediately.
  const items = (data?.items || []).filter((p) => !wish.loaded || wish.has(p.id));

  return (
    <div className="container page page-enter">
      <h1 style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 3rem)', marginBottom: 20 }}>My wishlist</h1>
      {loading && <ProductSkeletons count={4} cols4 />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && items.length === 0 && (
        <div className="empty">
          <Heart size={56} />
          <h2>Nothing saved yet</h2>
          <p className="muted">Tap the heart on any product to save it for later.</p>
          <Link to="/shop" className="btn btn-primary">Browse the shop</Link>
        </div>
      )}
      {items.length > 0 && <div className="grid-products cols-4">{items.map((p) => <ProductCard key={p.id} product={p} />)}</div>}
    </div>
  );
}
