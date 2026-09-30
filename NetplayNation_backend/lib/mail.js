const nodemailer = require('nodemailer');
const config = require('../config');

const transport = config.smtpUrl ? nodemailer.createTransport(config.smtpUrl) : null;

// In tests, messages are collected here instead of being sent.
const outbox = [];

// Sends an email without ever throwing: a mail outage must not break an order or a sign-in.
async function send({ to, subject, text, html }) {
  try {
    if (process.env.NODE_ENV === 'test') return void outbox.push({ to, subject, text, html });
    if (!transport) {
      console.log(`[mail:dev] to=${to} subject="${subject}"\n${text}\n`);
      return;
    }
    await transport.sendMail({ from: config.mailFrom, to, subject, text, html });
  } catch (err) {
    console.error(`[mail] failed to send "${subject}" to ${to}:`, err.message);
  }
}

module.exports = { send, outbox };
