import Claim from '../models/Claim.js';
import Item from '../models/Item.js';
import Chat from '../models/Chat.js';
import { uploadImages } from '../services/cloudinaryService.js';
import { notify } from '../services/notificationService.js';
import { canAcceptClaim } from '../services/policyService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseJsonField } from '../utils/request.js';

export const createClaim = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.itemId).select('+verificationQuestions.answer');
  if (!item || item.approvalStatus !== 'approved') throw new ApiError(404, 'Approved item report not found');
  const existingApproved = await Claim.exists({ item: item._id, status: 'approved' });
  if (!canAcceptClaim(item, req.user, existingApproved)) {
    if (item.reporter.equals(req.user._id)) throw new ApiError(403, 'You cannot claim your own found-item report');
    throw new ApiError(409, 'This item is not accepting new claims');
  }

  const answers = parseJsonField(req.body.verificationAnswers, []);
  if (item.verificationQuestions.length) {
    const answered = new Set(answers.filter((answer) => answer.answer?.trim()).map((answer) => String(answer.questionId)));
    const missing = item.verificationQuestions.some((question) => !answered.has(String(question._id)));
    if (missing) throw new ApiError(422, 'Answer every private verification question');
  }
  const uploaded = await uploadImages(req.files || [], 'campusfind/claims');
  const claim = await Claim.create({
    item: item._id,
    claimant: req.user._id,
    reason: req.body.reason,
    uniqueIdentificationAnswer: req.body.uniqueIdentificationAnswer,
    locationAnswer: req.body.locationAnswer,
    dateAnswer: req.body.dateAnswer,
    approximateTime: req.body.approximateTime,
    proofImages: uploaded,
    deviceSerialNumber: req.body.deviceSerialNumber,
    additionalInformation: req.body.additionalInformation,
    verificationAnswers: answers,
  });
  item.status = 'claim_requested';
  await item.save();
  const participantIds = [String(req.user._id), String(item.reporter)].sort();
  const contactKey = `${item._id}:${participantIds.join(':')}`;
  let chat = await Chat.findOne({ contactKey });
  if (chat) {
    chat.claim = claim._id;
    chat.kind = 'claim';
    await chat.save();
  } else {
    chat = await Chat.create({ claim: claim._id, item: item._id, participants: [req.user._id, item.reporter], kind: 'claim', contactKey });
  }
  await notify({
    recipient: item.reporter,
    title: 'New claim received',
    message: `${req.user.name} submitted a claim for “${item.title}”.`,
    type: 'claim_submitted', item: item._id, claim: claim._id, email: true,
  });
  res.status(201).json({ success: true, claim, chatId: chat._id, message: 'Claim submitted securely for review' });
});

export const myClaims = asyncHandler(async (req, res) => {
  const claims = await Claim.find({ claimant: req.user._id })
    .populate({ path: 'item', select: '-privateDetails -uniqueMarks -verificationQuestions.answer', populate: { path: 'reporter', select: 'name role profileImage' } })
    .sort({ createdAt: -1 });
  const chats = await Chat.find({ claim: { $in: claims.map((claim) => claim._id) } }).select('_id claim');
  const chatByClaim = new Map(chats.map((chat) => [String(chat.claim), chat._id]));
  res.json({
    success: true,
    claims: claims.map((claim) => ({ ...claim.toJSON(), chatId: chatByClaim.get(String(claim._id)) || null })),
  });
});

export const getClaim = asyncHandler(async (req, res) => {
  let claim = await Claim.findById(req.params.id).populate('item').populate('claimant', 'name email enrollmentNumber profileImage');
  if (!claim) throw new ApiError(404, 'Claim not found');
  const reporterId = claim.item.reporter?._id || claim.item.reporter;
  const allowed = claim.claimant._id.equals(req.user._id) || reporterId.equals(req.user._id) || ['admin', 'staff'].includes(req.user.role);
  if (!allowed) throw new ApiError(403, 'You cannot view this claim');
  if (['admin', 'staff'].includes(req.user.role) || reporterId.equals(req.user._id)) {
    claim = await Claim.findById(req.params.id)
      .select('+uniqueIdentificationAnswer +locationAnswer +dateAnswer +deviceSerialNumber +verificationAnswers.answer')
      .populate({ path: 'item', select: '+uniqueMarks +privateDetails +verificationQuestions.answer' })
      .populate('claimant', 'name email enrollmentNumber profileImage');
  }
  res.json({ success: true, claim });
});

export const itemClaims = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.itemId);
  if (!item) throw new ApiError(404, 'Item report not found');
  if (!item.reporter.equals(req.user._id) && !['admin', 'staff'].includes(req.user.role)) throw new ApiError(403, 'You cannot review these claims');
  const claims = await Claim.find({ item: item._id })
    .select('+uniqueIdentificationAnswer +locationAnswer +dateAnswer +deviceSerialNumber +verificationAnswers.answer')
    .populate('claimant', 'name email enrollmentNumber profileImage')
    .sort({ createdAt: -1 });
  res.json({ success: true, claims });
});

export const allClaims = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const claims = await Claim.find(filter)
    .populate({ path: 'item', select: 'title reportType status images reporter', populate: { path: 'reporter', select: 'name email' } })
    .populate('claimant', 'name email enrollmentNumber profileImage')
    .populate('reviewedBy', 'name role')
    .sort({ createdAt: -1 });
  res.json({ success: true, claims });
});

export const reviewClaim = asyncHandler(async (req, res) => {
  const claim = await Claim.findById(req.params.id).populate('item');
  if (!claim) throw new ApiError(404, 'Claim not found');
  if (!['pending', 'under_review'].includes(claim.status)) throw new ApiError(409, 'This claim has already been reviewed');
  if (req.body.decision === 'approve') {
    const approved = await Claim.exists({ item: claim.item._id, status: 'approved', _id: { $ne: claim._id } });
    if (approved) throw new ApiError(409, 'Only one claim can be approved for an item');
    claim.status = 'approved';
    claim.approvedAt = new Date();
    claim.item.status = 'claim_approved';
  } else {
    claim.status = 'rejected';
    claim.rejectionReason = req.body.rejectionReason;
    const activeClaims = await Claim.countDocuments({ item: claim.item._id, status: { $in: ['pending', 'under_review', 'approved'] }, _id: { $ne: claim._id } });
    claim.item.status = activeClaims ? 'claim_under_review' : 'active';
  }
  claim.reviewedBy = req.user._id;
  await Promise.all([claim.save(), claim.item.save()]);
  await notify({
    recipient: claim.claimant._id,
    title: `Claim ${claim.status}`,
    message: req.body.decision === 'approve'
      ? `Your claim for “${claim.item.title}” was approved. Schedule a secure handover next.`
      : `Your claim for “${claim.item.title}” was not approved.`,
    type: `claim_${claim.status}`, item: claim.item._id, claim: claim._id, email: true,
  });
  res.json({ success: true, claim, message: `Claim ${claim.status}` });
});

export const cancelClaim = asyncHandler(async (req, res) => {
  const claim = await Claim.findById(req.params.id);
  if (!claim) throw new ApiError(404, 'Claim not found');
  if (!claim.claimant.equals(req.user._id)) throw new ApiError(403, 'You can only cancel your own claim');
  if (!['pending', 'under_review'].includes(claim.status)) throw new ApiError(409, 'This claim can no longer be cancelled');
  claim.status = 'cancelled';
  await claim.save();
  res.json({ success: true, message: 'Claim cancelled' });
});
