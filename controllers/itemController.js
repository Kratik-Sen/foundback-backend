import mongoose from 'mongoose';
import QRCode from 'qrcode';
import Bookmark from '../models/Bookmark.js';
import Chat from '../models/Chat.js';
import Claim from '../models/Claim.js';
import Complaint from '../models/Complaint.js';
import Handover from '../models/Handover.js';
import Item from '../models/Item.js';
import Match from '../models/Match.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import { deleteImages, uploadImages } from '../services/cloudinaryService.js';
import { findDuplicateReports, generateMatches } from '../services/matchingService.js';
import { canEditItem } from '../services/policyService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex, pagination } from '../utils/query.js';
import { cleanText, parseJsonField, pick } from '../utils/request.js';
import { publicItem } from '../utils/serializers.js';

const editableFields = [
  'title', 'category', 'description', 'brand', 'colour', 'uniqueMarks', 'publicDetails', 'privateDetails',
  'date', 'approximateTime', 'location', 'building', 'floor', 'room', 'landmark', 'securityOfficeSubmitted',
  'currentItemLocation', 'contactPreference', 'handoverPreference', 'reward',
];

function prepareBody(body) {
  const data = pick(body, ['reportType', ...editableFields]);
  for (const [key, value] of Object.entries(data)) if (typeof value === 'string') data[key] = cleanText(value);
  if (body.privacy !== undefined) data.privacy = parseJsonField(body.privacy, {});
  if (body.verificationQuestions !== undefined) {
    data.verificationQuestions = parseJsonField(body.verificationQuestions, []).map((entry) => ({
      question: cleanText(entry.question), answer: cleanText(entry.answer),
    })).filter((entry) => entry.question && entry.answer);
  }
  if (body.securityOfficeSubmitted !== undefined) data.securityOfficeSubmitted = body.securityOfficeSubmitted === true || body.securityOfficeSubmitted === 'true';
  if (body.reward !== undefined) data.reward = Number(body.reward || 0);
  return data;
}

export const createItem = asyncHandler(async (req, res) => {
  const data = prepareBody(req.body);
  const duplicates = await findDuplicateReports(req.user._id, data);
  const acknowledged = req.body.duplicateAcknowledged === true || req.body.duplicateAcknowledged === 'true';
  if (duplicates.length && !acknowledged) {
    return res.status(409).json({
      success: false,
      code: 'POSSIBLE_DUPLICATES',
      message: 'Similar reports already exist. Please check them before submitting a new report.',
      duplicates: duplicates.map(publicItem),
    });
  }
  const images = await uploadImages(req.files || []);
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + Number(process.env.LISTING_EXPIRY_DAYS || 90));
  const item = await Item.create({
    ...data,
    images,
    reporter: req.user._id,
    currentHolder: data.reportType === 'found' ? req.user._id : undefined,
    status: 'active',
    approvalStatus: 'approved',
    approvedAt: new Date(),
    expiryDate,
    duplicateAcknowledged: acknowledged,
  });
  await generateMatches(item);
  res.status(201).json({ success: true, item: publicItem(item), message: 'Report published successfully' });
});

export const listItems = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const now = new Date();
  const filter = {
    approvalStatus: 'approved',
    status: { $in: ['active', 'possible_match', 'claim_requested', 'claim_under_review', 'claim_approved', 'handover_scheduled'] },
    expiryDate: { $gt: now },
  };
  if (['lost', 'found'].includes(req.query.type)) filter.reportType = req.query.type;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.location) filter.location = new RegExp(escapeRegex(req.query.location), 'i');
  if (req.query.status) filter.status = req.query.status;
  if (req.query.securityOffice === 'true') filter.securityOfficeSubmitted = true;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) filter.date.$lte = new Date(req.query.to);
  }
  if (req.query.search) filter.$text = { $search: req.query.search };
  const sort = req.query.sort === 'oldest' ? { createdAt: 1 } : req.query.sort === 'relevant' && req.query.search
    ? { score: { $meta: 'textScore' } }
    : { createdAt: -1 };
  const projection = req.query.search ? { score: { $meta: 'textScore' } } : {};
  const [items, total] = await Promise.all([
    Item.find(filter, projection).populate('reporter', 'name role profileImage').sort(sort).skip(skip).limit(limit),
    Item.countDocuments(filter),
  ]);
  res.json({ success: true, items: items.map(publicItem), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const getItem = asyncHandler(async (req, res) => {
  let item = await Item.findById(req.params.id).populate('reporter', 'name role profileImage phone email');
  if (!item) throw new ApiError(404, 'Item report not found');
  const privileged = req.user && (req.user.role === 'admin' || req.user.role === 'staff' || item.reporter._id.equals(req.user._id));
  if (item.approvalStatus !== 'approved' && !privileged) throw new ApiError(404, 'Item report not found');
  if (privileged) {
    item = await Item.findById(req.params.id)
      .select('+uniqueMarks +privateDetails +verificationQuestions.answer')
      .populate('reporter', 'name role profileImage phone email');
  }
  if (!req.user || !item.reporter._id.equals(req.user._id)) await Item.updateOne({ _id: item._id }, { $inc: { views: 1 } });
  res.json({ success: true, item: privileged ? item : publicItem(item) });
});

export const myItems = asyncHandler(async (req, res) => {
  const items = await Item.find({ reporter: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, items: items.map((item) => publicItem(item, { includeReporterContact: true })) });
});

export const updateItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id).select('+uniqueMarks +privateDetails +verificationQuestions.answer');
  if (!item) throw new ApiError(404, 'Item report not found');
  if (!canEditItem(item, req.user)) throw new ApiError(403, 'You cannot edit this report or it is already closed');
  const updates = prepareBody(req.body);
  delete updates.reportType;
  Object.assign(item, updates);
  let retainedImages = item.images;
  let removedImages = [];
  if (req.body.retainedImageIds !== undefined) {
    const retainedIds = new Set(parseJsonField(req.body.retainedImageIds, []).map(String));
    retainedImages = item.images.filter((image) => retainedIds.has(String(image.publicId || image.url)));
    removedImages = item.images.filter((image) => !retainedIds.has(String(image.publicId || image.url)));
  }
  if (retainedImages.length + (req.files?.length || 0) > 6) throw new ApiError(422, 'A report can contain at most 6 images');
  const uploadedImages = await uploadImages(req.files || []);
  item.images = [...retainedImages, ...uploadedImages];
  const needsActivation = item.approvalStatus !== 'approved' || ['pending_approval', 'rejected'].includes(item.status);
  item.approvalStatus = 'approved';
  if (needsActivation) item.status = 'active';
  item.approvedAt = item.approvedAt || new Date();
  item.approvedBy = undefined;
  item.rejectionReason = undefined;
  await item.save();
  await deleteImages(removedImages);
  await generateMatches(item);
  res.json({ success: true, item: publicItem(item), message: 'Report updated and published' });
});

export const deleteItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Item report not found');
  if (!item.reporter.equals(req.user._id) && req.user.role !== 'admin') throw new ApiError(403, 'You can only delete your own reports');
  const activeClaim = await Claim.exists({ item: item._id, status: { $in: ['pending', 'under_review', 'approved'] } });
  if (activeClaim && req.user.role !== 'admin') throw new ApiError(409, 'A report with an active claim can only be removed by an administrator');
  const claims = await Claim.find({ item: item._id });
  const claimIds = claims.map((claim) => claim._id);
  const chats = await Chat.find({ item: item._id });
  const chatIds = chats.map((chat) => chat._id);
  const messages = await Message.find({ chat: { $in: chatIds } });
  await deleteImages([
    ...item.images,
    ...claims.flatMap((claim) => claim.proofImages || []),
    ...messages.map((message) => message.image).filter((image) => image?.url),
  ]);
  await Promise.all([
    item.deleteOne(),
    Bookmark.deleteMany({ item: item._id }),
    Match.deleteMany({ $or: [{ lostItem: item._id }, { foundItem: item._id }] }),
    Claim.deleteMany({ _id: { $in: claimIds } }),
    Chat.deleteMany({ _id: { $in: chatIds } }),
    Message.deleteMany({ chat: { $in: chatIds } }),
    Handover.deleteMany({ item: item._id }),
    Notification.deleteMany({ item: item._id }),
    Complaint.updateMany({ item: item._id }, { $unset: { item: 1 } }),
  ]);
  res.json({ success: true, message: 'Report deleted permanently' });
});

export const getMatches = asyncHandler(async (req, res) => {
  const owned = await Item.find({ reporter: req.user._id }).select('_id');
  const ids = owned.map((item) => item._id);
  const matches = await Match.find({ $or: [{ lostItem: { $in: ids } }, { foundItem: { $in: ids } }], status: { $ne: 'dismissed' } })
    .populate({ path: 'lostItem foundItem', select: '-uniqueMarks -privateDetails -verificationQuestions.answer', populate: { path: 'reporter', select: 'name role profileImage' } })
    .sort({ matchingScore: -1 });
  res.json({ success: true, matches });
});

export const bookmarkItem = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid item identifier');
  const item = await Item.findOne({ _id: req.params.id, approvalStatus: 'approved' });
  if (!item) throw new ApiError(404, 'Item report not found');
  await Bookmark.findOneAndUpdate({ user: req.user._id, item: item._id }, {}, { upsert: true, setDefaultsOnInsert: true });
  res.status(201).json({ success: true, message: 'Item saved' });
});

export const removeBookmark = asyncHandler(async (req, res) => {
  await Bookmark.deleteOne({ user: req.user._id, item: req.params.id });
  res.json({ success: true, message: 'Item removed from saved items' });
});

export const getBookmarks = asyncHandler(async (req, res) => {
  const bookmarks = await Bookmark.find({ user: req.user._id }).populate({ path: 'item', populate: { path: 'reporter', select: 'name role profileImage' } }).sort({ createdAt: -1 });
  const ownIds = (await Item.find({ reporter: req.user._id }).select('_id')).map((item) => item._id);
  const savedIds = bookmarks.filter((entry) => entry.item).map((entry) => entry.item._id);
  const matches = await Match.find({
    $or: [
      { lostItem: { $in: ownIds }, foundItem: { $in: savedIds } },
      { foundItem: { $in: ownIds }, lostItem: { $in: savedIds } },
    ],
    status: { $ne: 'dismissed' },
  });
  const bookmarksWithScores = bookmarks.filter((entry) => entry.item).map((entry) => {
    const relevant = matches.filter((match) => String(match.lostItem) === String(entry.item._id) || String(match.foundItem) === String(entry.item._id));
    return { ...entry.toObject(), item: publicItem(entry.item), matchingScore: Math.max(0, ...relevant.map((match) => match.matchingScore)) || null };
  });
  res.json({ success: true, bookmarks: bookmarksWithScores });
});

export const itemQrCode = asyncHandler(async (req, res) => {
  const item = await Item.findOne({ _id: req.params.id, reportType: 'found', approvalStatus: 'approved' });
  if (!item) throw new ApiError(404, 'Approved found item not found');
  const url = `${process.env.CLIENT_URL || 'http://localhost:5173'}/items/${item._id}?verify=true`;
  const dataUrl = await QRCode.toDataURL(url, { width: 360, margin: 2, color: { dark: '#172554', light: '#ffffff' } });
  res.json({ success: true, qrCode: dataUrl, url });
});

export const extendItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Item report not found');
  if (!item.reporter.equals(req.user._id)) throw new ApiError(403, 'You can only extend your own report');
  item.expiryDate = new Date(Date.now() + Number(process.env.LISTING_EXPIRY_DAYS || 90) * 86_400_000);
  if (item.status === 'expired') item.status = item.approvalStatus === 'approved' ? 'active' : 'pending_approval';
  await item.save();
  res.json({ success: true, item: publicItem(item), message: 'Listing extended' });
});

export const markRecovered = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Item report not found');
  if (!item.reporter.equals(req.user._id) && req.user.role !== 'admin') throw new ApiError(403, 'You can only close your own report');
  if (item.status === 'returned') throw new ApiError(409, 'This item is already marked as returned');
  item.status = req.body.returned === true ? 'returned' : 'closed';
  if (item.status === 'returned') item.returnedAt = new Date();
  await item.save();
  res.json({ success: true, item: publicItem(item), message: item.status === 'returned' ? 'Item marked as recovered' : 'Listing closed' });
});

export { generateMatches };
