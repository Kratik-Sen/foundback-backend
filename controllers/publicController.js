import Announcement from '../models/Announcement.js';
import CampusLocation from '../models/CampusLocation.js';
import Category from '../models/Category.js';
import Item from '../models/Item.js';
import Setting from '../models/Setting.js';
import Testimonial from '../models/Testimonial.js';
import ContactMessage from '../models/ContactMessage.js';
import { ApiError } from '../utils/ApiError.js';
import { cleanText } from '../utils/request.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publicItem } from '../utils/serializers.js';

export const metadata = asyncHandler(async (_req, res) => {
  const [categories, locations, settings] = await Promise.all([
    Category.find({ active: true }).sort({ name: 1 }),
    CampusLocation.find({ active: true }).sort({ name: 1 }),
    Setting.find({ public: true }).select('key value'),
  ]);
  res.json({ success: true, categories, locations, settings: Object.fromEntries(settings.map((entry) => [entry.key, entry.value])) });
});

export const home = asyncHandler(async (_req, res) => {
  const filter = { approvalStatus: 'approved', expiryDate: { $gt: new Date() }, status: { $in: ['active', 'possible_match', 'claim_requested'] } };
  const [recent, lost, found, returned, users, announcements, testimonials] = await Promise.all([
    Item.find(filter).populate('reporter', 'name role profileImage').sort({ createdAt: -1 }).limit(8),
    Item.countDocuments({ ...filter, reportType: 'lost' }),
    Item.countDocuments({ ...filter, reportType: 'found' }),
    Item.countDocuments({ status: 'returned' }),
    Item.distinct('reporter'),
    Announcement.find({ active: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).select('title message').sort({ createdAt: -1 }).limit(3),
    Testimonial.find({ active: true }).sort({ order: 1 }).limit(6),
  ]);
  res.json({ success: true, recent: recent.map(publicItem), stats: { lost, found, returned, community: users.length }, announcements, testimonials });
});

export const contact = asyncHandler(async (req, res) => {
  const name = cleanText(req.body.name);
  const email = cleanText(req.body.email)?.toLowerCase();
  const subject = cleanText(req.body.subject);
  const message = cleanText(req.body.message);
  if (!name || !/^\S+@\S+\.\S+$/.test(email || '') || !subject || !message || message.length < 10) {
    throw new ApiError(422, 'Enter your name, valid email, subject, and a message of at least 10 characters');
  }
  await ContactMessage.create({ name, email, subject, message, ipAddress: req.ip });
  res.status(201).json({ success: true, message: 'Your message was sent to the FoundBack support team.' });
});
