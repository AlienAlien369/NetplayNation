import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MagnifyingGlass, SlidersHorizontal, X } from '@phosphor-icons/react';
import { rupees } from '../api';
import ProductCard from '../components/ProductCard';
import { ErrorState, ProductSkeletons, useApi, useTitle } from '../components/ui';

const SORTS = [
  ['new', 'Newest'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['rating', 'Top rated'],
];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const brands = (params.get('brand') || '').split(',').filter(Boolean);
  const inStock = params.get('inStock') === '1';
  const sort = params.get('sort') || 'new';
  const page = Number(params.get('page')) || 1;
  const [price, setPrice] = useState({ min: params.get('minPrice') || '', max: params.get('maxPrice') || '' });

  useTitle(category || (q ? `Search: ${q}` : 'Shop'), category ? `Shop ${category} gear online. Cash on delivery and secure payment across India.` : undefined);
  useEffect(() => {
    setPrice({ min: params.get('minPrice') || '', max: params.get('maxPrice') || '' });
  }, [params]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries({ page: '', ...changes })) (v ? next.set(k, v) : next.delete(k));
    setParams(next);
  };

  const query = new URLSearchParams({ limit: '12', sort, page: String(page) });
  if (q) query.set('q', q);
  if (category) query.set('category', category);
  if (brands.length) query.set('brand', brands.join(','));
  if (inStock) query.set('inStock', '1');
  for (const k of ['minPrice', 'maxPrice']) if (params.get(k)) query.set(k, params.get(k));

  const facets = useApi('/facets');
  const { data, error, loading, reload } = useApi(`/products?${query}`);

  const chips = [
    q && { label: `"${q}"`, clear: { q: '' } },
    category && { label: category, clear: { category: '' } },
    ...brands.map((b) => ({ label: b, clear: { brand: brands.filter((x) => x !== b).join(',') } })),
    params.get('minPrice') && { label: `From ${rupees(params.get('minPrice'))}`, clear: { minPrice: '' } },
    params.get('maxPrice') && { label: `Up to ${rupees(params.get('maxPrice'))}`, clear: { maxPrice: '' } },
    inStock && { label: 'In stock', clear: { inStock: '' } },
  ].filter(Boolean);

  const applyPrice = (e) => {
    e.preventDefault();
    update({ minPrice: price.min, maxPrice: price.max });
  };

  return (
    <div className="container page page-enter">
      <div className="crumbs"><Link to="/">Home</Link> / <span>{category || 'Shop'}</span></div>
      <div className="shop-head">
        <div>
          <h1 style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 3rem)' }}>{category || (q ? 'Search results' : 'All gear')}</h1>
          {data && <p className="muted" aria-live="polite">{data.total} {data.total === 1 ? 'product' : 'products'}</p>}
        </div>
        <div className="toolbar">
          <button className="btn btn-sm only-filter-btn" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}><SlidersHorizontal size={18} /> Filters</button>
          <label className="sr-only" htmlFor="sort">Sort by</label>
          <select id="sort" className="select" value={sort} onChange={(e) => update({ sort: e.target.value === 'new' ? '' : e.target.value })}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="shop-layout">
        <aside className={`filters ${showFilters ? 'open' : ''}`} aria-label="Filters">
          <div className="panel">
            <div className="filter-group">
              <h3>Sport</h3>
              <div className="filter-list">
                <label className="check"><input type="radio" name="cat" checked={!category} onChange={() => update({ category: '' })} /> All sports</label>
                {facets.data?.categories.map((c) => (
                  <label className="check" key={c.name}>
                    <input type="radio" name="cat" checked={category === c.name} onChange={() => update({ category: c.name })} /> {c.name} <span className="count">{c.count}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <h3>Brand</h3>
              <div className="filter-list">
                {facets.data?.brands.map((b) => (
                  <label className="check" key={b.name}>
                    <input
                      type="checkbox"
                      checked={brands.includes(b.name)}
                      onChange={(e) => update({ brand: (e.target.checked ? [...brands, b.name] : brands.filter((x) => x !== b.name)).join(',') })}
                    />
                    {b.name} <span className="count">{b.count}</span>
                  </label>
                ))}
              </div>
            </div>
            <form className="filter-group" onSubmit={applyPrice}>
              <h3>Price</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label className="sr-only" htmlFor="minp">Minimum price</label>
                <input id="minp" className="input" inputMode="numeric" placeholder="Min" value={price.min} onChange={(e) => setPrice({ ...price, min: e.target.value.replace(/\D/g, '') })} />
                <span aria-hidden="true">to</span>
                <label className="sr-only" htmlFor="maxp">Maximum price</label>
                <input id="maxp" className="input" inputMode="numeric" placeholder="Max" value={price.max} onChange={(e) => setPrice({ ...price, max: e.target.value.replace(/\D/g, '') })} />
              </div>
              <button className="btn btn-sm btn-block" style={{ marginTop: 10 }}>Apply price</button>
            </form>
            <div className="filter-group">
              <label className="check"><input type="checkbox" checked={inStock} onChange={(e) => update({ inStock: e.target.checked ? '1' : '' })} /> In stock only</label>
            </div>
          </div>
        </aside>

        <section aria-label="Products">
          {chips.length > 0 && (
            <div className="chips">
              {chips.map((c) => (
                <span className="chip" key={c.label}>{c.label}<button aria-label={`Remove filter ${c.label}`} onClick={() => update(c.clear)}><X size={14} /></button></span>
              ))}
              <button className="btn btn-sm btn-quiet" onClick={() => setParams(new URLSearchParams(sort !== 'new' ? { sort } : {}))}>Clear all</button>
            </div>
          )}
          {loading && !data && <ProductSkeletons count={6} />}
          {error && <ErrorState error={error} onRetry={reload} />}
          {data && data.items.length === 0 && (
            <div className="empty">
              <MagnifyingGlass size={44} />
              <h2>No products found</h2>
              <p className="muted">Try removing a filter or searching for something else.</p>
              <button className="btn btn-primary" onClick={() => setParams(new URLSearchParams())}>Clear filters</button>
            </div>
          )}
          {data && data.items.length > 0 && (
            <div className="grid-products" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
              {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
          {data && data.pages > 1 && (
            <nav className="pager" aria-label="Pagination">
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous</button>
              {Array.from({ length: data.pages }, (_, i) => i + 1).map((n) => (
                <button key={n} className="btn btn-sm" aria-current={n === page ? 'page' : undefined} aria-label={`Page ${n}`} onClick={() => update({ page: String(n) })}>{n}</button>
              ))}
              <button className="btn btn-sm" disabled={page >= data.pages} onClick={() => update({ page: String(page + 1) })}>Next</button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
