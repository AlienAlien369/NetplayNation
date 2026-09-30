export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Network problem. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'Something went wrong. Please try again.');
  return data;
}

export const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

let configPromise;
export const getConfig = () => (configPromise ||= api('/config').catch((e) => { configPromise = null; throw e; }));

let razorpayPromise;
export const loadRazorpay = () =>
  (razorpayPromise ||= new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => { razorpayPromise = null; reject(new Error('Could not load the payment window. Check your connection.')); };
    document.head.appendChild(s);
  }));

// Opens Razorpay checkout for a pending order. Resolves 'paid' after server-side verification, or 'dismissed'.
export async function payOrder(order, payment, email) {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: payment.keyId,
      amount: payment.amount,
      currency: 'INR',
      name: 'Netplay Nation',
      description: `Order ${order.orderNumber}`,
      order_id: payment.razorpayOrderId,
      prefill: { name: order.address.name, email, contact: order.address.phone },
      theme: { color: '#d13f08' },
      modal: { ondismiss: () => resolve('dismissed') },
      handler: async (response) => {
        try {
          await api(`/orders/${order.id}/verify`, { method: 'POST', body: response });
          resolve('paid');
        } catch (e) {
          reject(e);
        }
      },
    });
    rzp.open();
  });
}

export const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
