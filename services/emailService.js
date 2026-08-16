import { createTransport } from '../config/email.js';

export async function sendEmail({ to, subject, html, text }) {
  const transport = createTransport();
  if (!transport) {
    if (process.env.NODE_ENV === 'development') console.info(`[email preview] ${subject} -> ${to}`);
    return { preview: true };
  }
  return transport.sendMail({
    from: process.env.EMAIL_FROM || 'FoundBack <no-reply@campusfind.local>',
    to,
    subject,
    html,
    text,
  });
}

export function escapeEmailHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
