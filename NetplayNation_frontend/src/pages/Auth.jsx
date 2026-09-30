import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { WarningCircle } from '@phosphor-icons/react';
import { api } from '../api';
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
          {isLogin && <Link to="/forgot-password" className="link-more" style={{ justifySelf: 'start' }}>Forgot your password?</Link>}
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

export function ForgotPassword() {
  useTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/forgot', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <div className="auth panel page-enter" style={{ padding: 28 }}>
        <h1>Reset password</h1>
        {sent ? (
          <div className="alert alert-ok" role="status" style={{ marginTop: 16 }}>
            If an account exists for {email}, we have sent a link to reset the password. It works for 1 hour.
          </div>
        ) : (
          <>
            <p className="muted">Enter your email and we will send you a link to choose a new password.</p>
            <form onSubmit={submit} noValidate>
              {error && <div className="alert alert-error" role="alert"><WarningCircle size={20} style={{ flex: 'none' }} />{error}</div>}
              <Field id="email" label="Email"><input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Sending' : 'Send reset link'}</button>
            </form>
          </>
        )}
        <p style={{ marginTop: 18 }}><Link to="/login" className="link-more">Back to sign in</Link></p>
      </div>
    </div>
  );
}

export function ResetPassword() {
  useTitle('Choose a new password');
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/reset', { method: 'POST', body: { token, password } });
      // The server signed us in; reload so the app picks up the new session.
      window.location.assign('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <div className="auth panel page-enter" style={{ padding: 28 }}>
        <h1>New password</h1>
        {!token ? (
          <div className="alert alert-error" role="alert" style={{ marginTop: 16 }}>This reset link is incomplete. Please request a new one.</div>
        ) : (
          <form onSubmit={submit} noValidate>
            {error && <div className="alert alert-error" role="alert"><WarningCircle size={20} style={{ flex: 'none' }} />{error}</div>}
            <Field id="password" label="New password" hint="At least 8 characters"><input id="password" className="input" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Saving' : 'Save new password'}</button>
          </form>
        )}
        <p style={{ marginTop: 18 }}><Link to="/forgot-password" className="link-more">Request a new link</Link></p>
      </div>
    </div>
  );
}
