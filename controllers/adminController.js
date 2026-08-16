import Announcement from '../models/Announcement.js';
import AdminLog from '../models/AdminLog.js';
import CampusLocation from '../models/CampusLocation.js';
import Category from '../models/Category.js';
import Claim from '../models/Claim.js';
import Complaint from '../models/Complaint.js';
import ContactMessage from '../models/ContactMessage.js';
import Item from '../models/Item.js';
import Message from '../models/Message.js';
import Setting from '../models/Setting.js';
import User from '../models/User.js';
import { writeAdminLog } from '../services/adminLogService.js';
import { notify, notifyMany } from '../services/notificationService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex, pagination } from '../utils/query.js';
import { pick } from '../utils/request.js';
import { publicUser } from '../utils/serializers.js';

export const dashboardStats = asyncHandler(async (_req, res) => {
  const now = new Date();
  const [
    totalUsers, activeStudents, lost, found, pendingClaims, returned,
    reported, blocked, monthly, categories, locations, claimStatus, registrations,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'student', accountStatus: 'active' }),
    Item.countDocuments({ reportType: 'lost' }),
    Item.countDocuments({ reportType: 'found' }),
    Claim.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
    Item.countDocuments({ status: 'returned' }),
    Complaint.countDocuments({ status: { $in: ['open', 'under_review'] } }),
    User.countDocuments({ accountStatus: 'blocked' }),
    Item.aggregate([
      { $match: { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } },
      { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, type: '$reportType' }, count: { $sum: 1 } } },
      { $sort: { '_id.month': 1 } },
    ]),
    Item.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 7 }]),
    Item.aggregate([{ $group: { _id: '$location', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 7 }]),
    Claim.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.aggregate([
      { $match: { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const reportsByMonth = [...new Set(monthly.map((entry) => entry._id.month))].map((month) => ({
    month,
    lost: monthly.find((entry) => entry._id.month === month && entry._id.type === 'lost')?.count || 0,
    found: monthly.find((entry) => entry._id.month === month && entry._id.type === 'found')?.count || 0,
  }));
  const [expired, rejectedClaims, suspiciousUsers, recoveryTime] = await Promise.all([
    Item.countDocuments({ status: 'expired' }),
    Claim.countDocuments({ status: 'rejected' }),
    User.countDocuments({ $or: [{ warningCount: { $gt: 0 } }, { accountStatus: { $in: ['blocked', 'suspended'] } }] }),
    Item.aggregate([
      { $match: { returnedAt: { $type: 'date' } } },
      { $project: { days: { $divide: [{ $subtract: ['$returnedAt', '$createdAt'] }, 86_400_000] } } },
      { $group: { _id: null, average: { $avg: '$days' } } },
    ]),
  ]);
  res.json({
    success: true,
    stats: {
      totalUsers, activeStudents, lost, found, pendingClaims, returned, reported, blocked,
      recoveryRate: lost + found ? Math.round((returned / (lost + found)) * 100) : 0,
      expired, rejectedClaims, suspiciousUsers,
      averageRecoveryDays: recoveryTime[0] ? Math.round(recoveryTime[0].average * 10) / 10 : 0,
    },
    charts: { reportsByMonth, categories, locations, claimStatus, registrations },
  });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.accountStatus = req.query.status;
  if (req.query.search) filter.$or = [
    { name: new RegExp(escapeRegex(req.query.search), 'i') },
    { email: new RegExp(escapeRegex(req.query.search), 'i') },
    { enrollmentNumber: new RegExp(escapeRegex(req.query.search), 'i') },
  ];
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, users: users.map(publicUser), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const createManagedUser = asyncHandler(async (req, res) => {
  if (!['staff', 'admin'].includes(req.body.role)) throw new ApiError(422, 'Managed accounts must be staff or admin');
  const user = await User.create({
    ...pick(req.body, ['name', 'email', 'password', 'phone', 'department', 'enrollmentNumber']),
    role: req.body.role,
    emailVerified: true,
  });
  await writeAdminLog(req, 'create_user', 'User', user._id, { role: user.role });
  res.status(201).json({ success: true, user: publicUser(user), message: `${user.role} account created` });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (user._id.equals(req.user._id) && req.body.accountStatus === 'blocked') throw new ApiError(409, 'You cannot block your own account');
  Object.assign(user, pick(req.body, ['name', 'role', 'department', 'accountStatus', 'warningCount']));
  await user.save();
  await writeAdminLog(req, 'update_user', 'User', user._id, pick(req.body, ['role', 'accountStatus', 'warningCount']));
  res.json({ success: true, user: publicUser(user), message: 'User updated' });
});

export const listAllItems = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = {};
  if (req.query.approval) filter.approvalStatus = req.query.approval;
  if (req.query.type) filter.reportType = req.query.type;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) filter.$text = { $search: req.query.search };
  const [items, total] = await Promise.all([
    Item.find(filter).populate('reporter', 'name email enrollmentNumber role').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Item.countDocuments(filter),
  ]);
  res.json({ success: true, items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const listComplaints = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const complaints = await Complaint.find(filter)
    .populate('reportedBy reportedUser', 'name email role accountStatus')
    .populate('item', 'title reportType status')
    .sort({ createdAt: -1 });
  const chatIds = complaints.filter((entry) => entry.chat).map((entry) => entry.chat);
  const messages = chatIds.length
    ? await Message.find({ chat: { $in: chatIds }, reported: true }).populate('sender', 'name email role').sort({ createdAt: 1 })
    : [];
  const serialized = complaints.map((entry) => ({
    ...entry.toObject(),
    chatMessages: messages.filter((message) => String(message.chat) === String(entry.chat)),
  }));
  res.json({ success: true, complaints: serialized });
});

export const reviewComplaint = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new ApiError(404, 'Complaint not found');
  if (['resolved', 'closed'].includes(complaint.status) && complaint.adminAction) throw new ApiError(409, 'This complaint has already been answered');
  const adminAction = req.body.adminAction?.trim();
  if (!adminAction) throw new ApiError(422, 'Write a response for the student who submitted the complaint');
  complaint.status = req.body.status || 'resolved';
  complaint.adminAction = adminAction;
  complaint.reviewedBy = req.user._id;
  if (req.body.blockUser && complaint.reportedUser) await User.findByIdAndUpdate(complaint.reportedUser, { accountStatus: 'blocked' });
  if (req.body.hideListing && complaint.item) await Item.findByIdAndUpdate(complaint.item, { status: 'closed' });
  await complaint.save();
  await Promise.all([
    writeAdminLog(req, 'review_complaint', 'Complaint', complaint._id, { action: adminAction }),
    notify({
      recipient: complaint.reportedBy,
      title: 'Your complaint was reviewed',
      message: `Admin response: ${adminAction}`,
      type: 'complaint_resolved',
      item: complaint.item,
      claim: complaint.claim,
      complaint: complaint._id,
    }),
  ]);
  res.json({ success: true, complaint, message: 'Response sent to the student' });
});

export const listContactMessages = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const messages = await ContactMessage.find(filter).sort({ createdAt: -1 }).limit(250);
  res.json({ success: true, messages });
});

export const updateContactMessage = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!message) throw new ApiError(404, 'Contact message not found');
  await writeAdminLog(req, 'update_contact_message', 'ContactMessage', message._id, { status: message.status });
  res.json({ success: true, message, statusMessage: 'Support message updated' });
});

function crudController(Model, label) {
  return {
    list: asyncHandler(async (_req, res) => res.json({ success: true, data: await Model.find().sort({ name: 1 }) })),
    create: asyncHandler(async (req, res) => {
      const record = await Model.create(req.body);
      await writeAdminLog(req, `create_${label}`, label, record._id);
      res.status(201).json({ success: true, data: record, message: `${label} created` });
    }),
    update: asyncHandler(async (req, res) => {
      const record = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!record) throw new ApiError(404, `${label} not found`);
      await writeAdminLog(req, `update_${label}`, label, record._id);
      res.json({ success: true, data: record, message: `${label} updated` });
    }),
    remove: asyncHandler(async (req, res) => {
      const record = await Model.findById(req.params.id);
      if (!record) throw new ApiError(404, `${label} not found`);
      if (label === 'category' && await Item.exists({ category: record.name })) throw new ApiError(409, 'Disable categories that are already used instead of deleting them');
      await record.deleteOne();
      await writeAdminLog(req, `delete_${label}`, label, record._id);
      res.json({ success: true, message: `${label} deleted` });
    }),
  };
}

export const categories = crudController(Category, 'category');
export const locations = crudController(CampusLocation, 'location');

export const listLogs = asyncHandler(async (_req, res) => {
  const logs = await AdminLog.find().populate('admin', 'name email').sort({ createdAt: -1 }).limit(250);
  res.json({ success: true, logs });
});

export const listSettings = asyncHandler(async (_req, res) => res.json({ success: true, settings: await Setting.find().sort({ key: 1 }) }));

export const updateSetting = asyncHandler(async (req, res) => {
  const setting = await Setting.findOneAndUpdate(
    { key: req.params.key },
    { value: req.body.value, description: req.body.description, public: Boolean(req.body.public), updatedBy: req.user._id },
    { upsert: true, new: true, runValidators: true },
  );
  await writeAdminLog(req, 'update_setting', 'Setting', setting._id, { key: setting.key });
  res.json({ success: true, setting, message: 'Setting updated' });
});

export const listAnnouncements = asyncHandler(async (_req, res) => res.json({ success: true, announcements: await Announcement.find().populate('createdBy', 'name').sort({ createdAt: -1 }) }));

export const createAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.create({ ...pick(req.body, ['title', 'message', 'audience', 'expiresAt']), createdBy: req.user._id });
  const userFilter = announcement.audience === 'all' ? { accountStatus: 'active' } : { role: announcement.audience, accountStatus: 'active' };
  const recipients = await User.find(userFilter).select('_id');
  await notifyMany(recipients.map((user) => user._id), { title: announcement.title, message: announcement.message, type: 'announcement' });
  await writeAdminLog(req, 'create_announcement', 'Announcement', announcement._id);
  res.status(201).json({ success: true, announcement, message: 'Announcement sent' });
});

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export const exportItemsCsv = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }
  const items = await Item.find(filter).populate('reporter', 'name email enrollmentNumber').sort({ createdAt: -1 });
  const headers = ['ID', 'Title', 'Type', 'Category', 'Location', 'Status', 'Approval', 'Reporter', 'Email', 'Reported At', 'Returned At'];
  const rows = items.map((item) => [item._id, item.title, item.reportType, item.category, item.location, item.status, item.approvalStatus, item.reporter?.name, item.reporter?.email, item.createdAt.toISOString(), item.returnedAt?.toISOString() || '']);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="foundback-items-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

export const staffDashboard = asyncHandler(async (req, res) => {
  const filter = req.user.department ? { $or: [{ building: req.user.department }, { location: req.user.department }] } : {};
  const [securityItems, pendingClaims, handovers, recent] = await Promise.all([
    Item.countDocuments({ ...filter, securityOfficeSubmitted: true, status: { $ne: 'returned' } }),
    Claim.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
    Item.countDocuments({ ...filter, status: 'handover_scheduled' }),
    Item.find({ ...filter, securityOfficeSubmitted: true }).populate('reporter', 'name enrollmentNumber').sort({ createdAt: -1 }).limit(8),
  ]);
  res.json({ success: true, stats: { securityItems, pendingClaims, handovers }, recent });
});
