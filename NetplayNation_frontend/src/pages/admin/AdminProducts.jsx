import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, WarningCircle } from '@phosphor-icons/react';
import { api, rupees } from '../../api';
import { ErrorState, Field, ProductImage, useApi, useTitle } from '../../components/ui';

export function ProductList() {
  useTitle('Admin products');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi(`/admin/products?page=${page}&limit=20${term ? `&q=${encodeURIComponent(term)}` : ''}`);

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.title}"? Existing orders keep their copy of the item.`)) return;
    try { await api(`/admin/products/${p.id}`, { method: 'DELETE' }); toast.success('Product deleted'); reload(); } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); setPage(1); }}>
          <label className="sr-only" htmlFor="pq">Search products</label>
          <input id="pq" className="input" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-sm">Search</button>
        </form>
        <Link to="/admin/products/new" className="btn btn-primary"><Plus size={18} weight="bold" /> Add product</Link>
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <div className="skeleton" style={{ height: 200 }} aria-busy="true" />}
      {data && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.items.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 32 }}>No products found.</td></tr>}
              {data.items.map((p) => (
                <tr key={p.id}>
                  <td><div className="cell-flex"><div className="thumb-sm"><ProductImage product={p} size="sm" /></div><div><b>{p.title}</b><div className="muted" style={{ fontSize: '.85rem' }}>{p.brand}</div></div></div></td>
                  <td>{p.category}</td>
                  <td>{rupees(p.price)}</td>
                  <td><span className={`badge ${p.stock === 0 ? 'badge-danger' : p.stock <= 5 ? 'badge-warn' : ''}`}>{p.stock}</span></td>
                  <td>{p.active ? <span className="badge badge-ok">Live</span> : <span className="badge">Hidden</span>}{p.featured && <span className="badge" style={{ marginLeft: 6 }}>Featured</span>}</td>
                  <td><div className="row-actions"><Link className="btn btn-sm" to={`/admin/products/${p.id}`}>Edit</Link><button className="btn btn-sm btn-danger" onClick={() => remove(p)}>Delete</button></div></td>
                </tr>
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

const empty = { title: '', brand: '', category: '', price: '', mrp: '', stock: '', images: '', description: '', featured: false, active: true };

export function ProductForm() {
  const { id } = useParams();
  const nav = useNavigate();
  useTitle(id ? 'Edit product' : 'Add product');
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const facets = useApi('/facets');

  useEffect(() => {
    if (!id) return;
    api(`/admin/products/${id}`)
      .then(({ product: p }) => setForm({ ...p, mrp: p.mrp ?? '', images: p.images.join('\n') }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const body = {
      title: form.title, brand: form.brand, category: form.category, description: form.description,
      price: Number(form.price), stock: Number(form.stock), mrp: form.mrp === '' ? null : Number(form.mrp),
      images: form.images.split('\n').map((s) => s.trim()).filter(Boolean),
      featured: form.featured, active: form.active,
    };
    try {
      await api(id ? `/admin/products/${id}` : '/admin/products', { method: id ? 'PUT' : 'POST', body });
      toast.success(id ? 'Product updated' : 'Product added');
      nav('/admin/products');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (loading) return <div className="skeleton" style={{ height: 300 }} aria-busy="true" />;

  return (
    <form className="panel" onSubmit={submit} style={{ maxWidth: 780 }}>
      <h2 style={{ marginBottom: 16 }}>{id ? 'Edit product' : 'Add product'}</h2>
      {error && <div className="alert alert-error" role="alert" style={{ marginBottom: 16 }}><WarningCircle size={20} style={{ flex: 'none' }} />{error}</div>}
      <div className="form-grid two">
        <Field id="title" label="Title" className="span-2"><input id="title" className="input" required minLength={3} value={form.title} onChange={set('title')} /></Field>
        <Field id="brand" label="Brand"><input id="brand" className="input" required value={form.brand} onChange={set('brand')} /></Field>
        <Field id="category" label="Sport / category">
          <input id="category" className="input" required list="cats" value={form.category} onChange={set('category')} />
          <datalist id="cats">{facets.data?.categories.map((c) => <option key={c.name} value={c.name} />)}</datalist>
        </Field>
        <Field id="price" label="Selling price (INR)" hint="Whole rupees, including tax"><input id="price" className="input" type="number" min="1" step="1" required value={form.price} onChange={set('price')} /></Field>
        <Field id="mrp" label="MRP (INR, optional)" hint="Shown struck through when higher than the price"><input id="mrp" className="input" type="number" min="1" step="1" value={form.mrp} onChange={set('mrp')} /></Field>
        <Field id="stock" label="Stock"><input id="stock" className="input" type="number" min="0" step="1" required value={form.stock} onChange={set('stock')} /></Field>
        <div />
        <Field id="images" label="Image links" hint="One https link per line. The first is the main image." className="span-2"><textarea id="images" className="textarea" value={form.images} onChange={set('images')} placeholder="https://..." /></Field>
        <Field id="description" label="Description" className="span-2"><textarea id="description" className="textarea" maxLength={4000} value={form.description} onChange={set('description')} /></Field>
        <label className="check"><input type="checkbox" checked={form.active} onChange={set('active')} /> Visible in the shop</label>
        <label className="check"><input type="checkbox" checked={form.featured} onChange={set('featured')} /> Featured on the home page</label>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving' : 'Save product'}</button>
        <Link className="btn" to="/admin/products">Cancel</Link>
      </div>
    </form>
  );
}
