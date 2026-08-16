import Notification from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination } from '../utils/query.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { recipient: req.user._id };
  if (req.query.unread === 'true') filter.read = false;
  const [notifications, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, read: false }),
  ]);
  res.json({ success: true, notifications, unread, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { read: true }, { new: true });
  res.json({ success: true, notification });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
  res.json({ success: true, message: 'All notifications marked as read' });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, recipient: req.user._id });
  res.json({ success: true, message: 'Notification deleted' });
});
