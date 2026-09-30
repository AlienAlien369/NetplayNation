import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCart } from '../state';
import { discountPct, Price, ProductImage, RatingLine, WishlistButton } from './ui';

export default function ProductCard({ product }) {
  const { add } = useCart();
  const off = discountPct(product.price, product.mrp);
  const soldOut = product.stock <= 0;
  const href = `/product/${product.slug}`;

  return (
    <article className="card">
      <div className="card-media">
        <Link to={href} tabIndex={-1} aria-hidden="true" className="card-media-link">
          <ProductImage product={product} />
        </Link>
        <div className="card-flags">
          {off > 0 && !soldOut && <span className="badge badge-sale">{off}% off</span>}
          {soldOut && <span className="badge">Sold out</span>}
        </div>
        <WishlistButton productId={product.id} title={product.title} className="heart-card" />
      </div>
      <div className="card-body">
        <span className="card-brand">{product.brand}</span>
        <h3 className="card-title">
          <Link to={href}>{product.title}</Link>
        </h3>
        <RatingLine avg={product.ratingAvg} count={product.ratingCount} size={14} />
        <div className="card-foot">
          <Price price={product.price} mrp={product.mrp} />
          {!soldOut && product.stock <= 5 && <span className="stock-note">Only {product.stock} left</span>}
          <button
            className="btn btn-sm btn-dark"
            disabled={soldOut}
            onClick={() => {
              add(product.id);
              toast.success('Added to cart');
            }}
          >
            {soldOut ? 'Sold out' : 'Add to cart'}
          </button>
        </div>
      </div>
    </article>
  );
}
