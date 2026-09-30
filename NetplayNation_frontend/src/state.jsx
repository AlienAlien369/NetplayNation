import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const AuthCtx = createContext(null);
const CartCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);
export const useCart = () => useContext(CartCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/auth/me').then((r) => setUser(r.user)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login: async (body) => setUser((await api('/auth/login', { method: 'POST', body })).user),
      register: async (body) => setUser((await api('/auth/register', { method: 'POST', body })).user),
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => {});
        setUser(null);
      },
    }),
    [user, loading]
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

const KEY = 'np_cart_v1';
const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(v) ? v.filter((i) => i && typeof i.id === 'string' && i.qty > 0) : [];
  } catch {
    return [];
  }
};

// The cart stores only ids and quantities. Prices and stock always come from the server.
export function CartProvider({ children }) {
  const [items, setItems] = useState(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch { /* storage unavailable: cart lasts for this visit only */ }
  }, [items]);

  useEffect(() => {
    const sync = (e) => e.key === KEY && setItems(read());
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const add = useCallback((id, qty = 1) => {
    setItems((cur) => {
      const found = cur.find((i) => i.id === id);
      return found ? cur.map((i) => (i.id === id ? { ...i, qty: Math.min(i.qty + qty, 10) } : i)) : [...cur, { id, qty: Math.min(qty, 10) }];
    });
  }, []);
  const setQty = useCallback((id, qty) => {
    setItems((cur) => (qty <= 0 ? cur.filter((i) => i.id !== id) : cur.map((i) => (i.id === id ? { ...i, qty: Math.min(qty, 10) } : i))));
  }, []);
  const remove = useCallback((id) => setItems((cur) => cur.filter((i) => i.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, add, setQty, remove, clear, count: items.reduce((s, i) => s + i.qty, 0) }),
    [items, add, setQty, remove, clear]
  );
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}
