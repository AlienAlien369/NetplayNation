const config = require('../config');
const { send } = require('./mail');

const STORE = 'Netplay Nation';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const inr = (n) => `Rs. ${Number(n).toLocaleString('en-IN')}`;

const layout = (heading, body) => `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#0e1621">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:10px;padding:28px">
<tr><td><div style="font-size:20px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${STORE}</div>
<h1 style="font-size:22px;margin:18px 0 12px">${esc(heading)}</h1>${body}
<p style="color:#5f6a7a;font-size:13px;margin-top:28px">Questions? Just reply to this email.</p></td></tr></table></td></tr></table></body></html>`;

const button = (href, label) =>
  `<p><a href="${esc(href)}" style="display:inline-block;background:#d13f08;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">${esc(label)}</a></p>`;

const itemsTable = (order) =>
  `<table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;border-top:1px solid #dde1e7">${order.items
    .map((i) => `<tr><td>${esc(i.title)} x ${i.qty}</td><td align="right">${inr(i.price * i.qty)}</td></tr>`)
    .join('')}
<tr><td>Shipping</td><td align="right">${order.shipping ? inr(order.shipping) : 'Free'}</td></tr>
${order.discount ? `<tr><td>Discount (${esc(order.couponCode)})</td><td align="right">-${inr(order.discount)}</td></tr>` : ''}
<tr><td><b>Total</b></td><td align="right"><b>${inr(order.total)}</b></td></tr></table>`;

const orderUrl = (order) => `${config.appUrl}/orders/${order.id}`;
const addr = (a) => [a.name, a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`, a.phone].filter(Boolean).join('\n');

exports.orderPlaced = (order, user) =>
  send({
    to: user.email,
    subject: `Order ${order.orderNumber} confirmed`,
    text: `Hi ${user.name},\n\nThanks for your order ${order.orderNumber}.\n\n${order.items.map((i) => `${i.title} x ${i.qty}: ${inr(i.price * i.qty)}`).join('\n')}\n\nTotal: ${inr(order.total)} (${order.paymentMethod === 'cod' ? 'pay on delivery' : 'paid online'})\n\nDelivering to:\n${addr(order.address)}\n\nTrack your order: ${orderUrl(order)}\n`,
    html: layout(
      `Thanks, ${user.name.split(' ')[0]}. Your order is confirmed`,
      `<p>Order <b>${esc(order.orderNumber)}</b> is placed. ${order.paymentMethod === 'cod' ? 'Please keep the amount ready for delivery.' : 'Your payment was received.'}</p>${itemsTable(order)}
<p style="white-space:pre-line;color:#4a5565">${esc(addr(order.address))}</p>${button(orderUrl(order), 'Track your order')}`
    ),
  });

exports.orderShipped = (order, user) =>
  send({
    to: user.email,
    subject: `Order ${order.orderNumber} has shipped`,
    text: `Hi ${user.name},\n\nYour order ${order.orderNumber} is on its way.\nTrack it: ${orderUrl(order)}\n`,
    html: layout('Your order is on its way', `<p>Order <b>${esc(order.orderNumber)}</b> has shipped and should arrive in a few days.</p>${button(orderUrl(order), 'Track your order')}`),
  });

exports.orderCancelled = (order, user, { refunded = false } = {}) =>
  send({
    to: user.email,
    subject: `Order ${order.orderNumber} cancelled`,
    text: `Hi ${user.name},\n\nYour order ${order.orderNumber} was cancelled.${refunded ? ` A refund of ${inr(order.total)} has been started and reaches you in 5 to 7 business days.` : ''}\n`,
    html: layout('Your order was cancelled', `<p>Order <b>${esc(order.orderNumber)}</b> was cancelled.</p>${refunded ? `<p>A refund of <b>${inr(order.total)}</b> has been started. It reaches your original payment method in 5 to 7 business days.</p>` : ''}`),
  });

exports.passwordReset = (user, link) =>
  send({
    to: user.email,
    subject: 'Reset your password',
    text: `Hi ${user.name},\n\nUse this link to choose a new password (valid for 1 hour):\n${link}\n\nIf you did not ask for this, you can ignore this email.\n`,
    html: layout('Reset your password', `<p>Use the button below to choose a new password. The link works for 1 hour.</p>${button(link, 'Choose a new password')}<p style="color:#5f6a7a;font-size:13px">If you did not ask for this, you can ignore this email.</p>`),
  });
