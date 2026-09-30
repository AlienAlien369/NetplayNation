import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { WarningCircle } from '@phosphor-icons/react';
import { useAuth } from '../state';
import { Field, useTitle } from '../components/ui';

function useAfterAuth() {
  const [params] = useSearchParams();
  const next = params.get('next');
  // Only allow same-site relative paths to prevent open redirects.
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function AuthForm({ mode }) {
  const isLogin = mode === 'login';
  useTitle(isLogin ? 'Sign in' : 'Create account');
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const next = useAfterAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (user) return <Navigate to={next} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await (isLogin ? login({ email: form.email, password: form.password }) : register(form));
      nav(next, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const other = `${isLogin ? '/register' : '/login'}${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;

  return (
    <div className="container page">
      <div className="auth panel page-enter" style={{ padding: 28 }}>
        <h1>{isLogin ? 'Sign in' : 'Create account'}</h1>
        <p className="muted">{isLogin ? 'Welcome back. Sign in to check out and track orders.' : 'Save time at checkout and track every order.'}</p>
        <form onSubmit={submit} noValidate>
          {error && <div className="alert alert-error" role="alert"><WarningCircle size={20} style={{ flex: 'none' }} />{error}</div>}
          {!isLogin && (
            <Field id="name" label="Full name">
              <input id="name" className="input" autoComplete="name" required value={form.name} onChange={set('name')} />
            </Field>
          )}
          <Field id="email" label="Email">
            <input id="email" className="input" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
          </Field>
          <Field id="password" label="Password" hint={isLogin ? undefined : 'At least 8 characters'}>
            <input id="password" className="input" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} required minLength={isLogin ? 1 : 8} value={form.password} onChange={set('password')} />
          </Field>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Please wait' : isLogin ? 'Sign in' : 'Create account'}</button>
        </form>
        <p style={{ marginTop: 18 }} className="muted">
          {isLogin ? 'New here? ' : 'Already have an account? '}
          <Link to={other} className="link-more">{isLogin ? 'Create an account' : 'Sign in'}</Link>
        </p>
      </div>
    </div>
  );
}

export const Login = () => <AuthForm mode="login" />;
export const Register = () => <AuthForm mode="register" />;
