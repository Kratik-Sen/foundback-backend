import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { escapeEmailHtml, sendEmail } from './emailService.js';

let socketServer;

export function setNotificationSocket(io) {
  socketServer = io;
}

export async function notify({ recipient, title, message, type, item, claim, complaint, email = false }) {
  const notification = await Notification.create({ recipient, title, message, type, item, claim, complaint });
  socketServer?.to(`user:${recipient}`).emit('notification:new', notification);

  if (email) {
    const user = await User.findById(recipient).select('email name');
    if (user) await sendEmail({ to: user.email, subject: title, text: message, html: `<p>Hello ${escapeEmailHtml(user.name)},</p><p>${escapeEmailHtml(message)}</p>` });
  }
  return notification;
}

export async function notifyMany(recipients, payload) {
  return Promise.all([...new Set(recipients.map(String))].map((recipient) => notify({ recipient, ...payload })));
}
