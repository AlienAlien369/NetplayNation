import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Star } from '@phosphor-icons/react';
import { api, fmtDate } from '../api';
import { useAuth } from '../state';
import { ErrorState, Field, Stars, useApi } from './ui';

function StarPicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Your rating" className="star-picker">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className="icon-btn"
          onClick={() => onChange(n)}
        >
          <Star size={28} weight={n <= value ? 'fill' : 'regular'} />
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ slug, existing, onSaved }) {
  const [form, setForm] = useState({ rating: existing?.rating || 0, title: existing?.title || '', body: existing?.body || '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.rating) return setError('Choose a star rating.');
    setBusy(true);
    setError('');
    try {
      await api(`/products/${slug}/reviews`, { method: 'POST', body: form });
      toast.success(existing ? 'Review updated' : 'Thanks for your review');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel review-form" onSubmit={submit} noValidate>
      <h3>{existing ? 'Edit your review' : 'Write a review'}</h3>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="field"><span className="label">Rating</span><StarPicker value={form.rating} onChange={(rating) => setForm({ ...form, rating })} /></div>
      <Field id="rv-title" label="Headline (optional)"><input id="rv-title" className="input" maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
      <Field id="rv-body" label="Your review (optional)"><textarea id="rv-body" className="textarea" maxLength={1500} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving' : existing ? 'Update review' : 'Post review'}</button>
    </form>
  );
}

export default function Reviews({ slug, onChanged }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi(`/products/${slug}/reviews?page=${page}`);
  useEffect(() => setPage(1), [slug]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <div className="skeleton" style={{ height: 160 }} aria-busy="true" />;

  const { summary, items, me } = data;
  const saved = () => { reload(); onChanged?.(); };
  const remove = async (id) => {
    if (!window.confirm('Delete your review?')) return;
    try { await api(`/reviews/${id}`, { method: 'DELETE' }); toast.success('Review deleted'); saved(); } catch (e) { toast.error(e.message); }
  };

  return (
    <section className="reviews" aria-labelledby="reviews-h">
      <h2 id="reviews-h">Customer reviews</h2>
      <div className="reviews-grid">
        <div>
          {summary.count > 0 ? (
            <>
              <div className="avg"><b>{summary.avg.toFixed(1)}</b><Stars value={summary.avg} size={20} /></div>
              <p className="muted">Based on {summary.count} {summary.count === 1 ? 'review' : 'reviews'}</p>
              <div className="breakdown">
                {[5, 4, 3, 2, 1].map((s) => (
                  <div key={s}><span>{s} star</span><i style={{ width: `${(summary.breakdown[s] / summary.count) * 100}%` }} /><span>{summary.breakdown[s]}</span></div>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">No reviews yet.</p>
          )}
          <div style={{ marginTop: 18 }}>
            {!user && <p className="muted"><Link to={`/login?next=${encodeURIComponent(pathname)}`} className="link-more">Sign in</Link> to review products you have received.</p>}
            {user && me && !me.canReview && !me.review && <p className="muted">Only customers who received this product can review it.</p>}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          {user && me && (me.canReview || me.review) && <ReviewForm key={me.review?.id || 'new'} slug={slug} existing={me.review} onSaved={saved} />}
          {items.map((r) => (
            <article className="review" key={r.id}>
              <div className="line-row"><Stars value={r.rating} /><span className="muted">{fmtDate(r.createdAt)}</span></div>
              {r.title && <b>{r.title}</b>}
              {r.body && <p>{r.body}</p>}
              <div className="line-row">
                <span className="muted">{r.author}<span className="badge badge-ok" style={{ marginLeft: 8 }}>Verified buyer</span></span>
                {me?.review?.id === r.id && <button className="btn btn-sm btn-quiet" onClick={() => remove(r.id)}>Delete</button>}
              </div>
            </article>
          ))}
          {data.pages > 1 && (
            <div className="pager" style={{ marginTop: 0 }}>
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</button>
              <span style={{ alignSelf: 'center' }}>Page {page} of {data.pages}</span>
              <button className="btn btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Older</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
