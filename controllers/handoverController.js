import mongoose from 'mongoose';
import Claim from '../models/Claim.js';
import Handover from '../models/Handover.js';
import Item from '../models/Item.js';
import User from '../models/User.js';
import { notify, notifyMany } from '../services/notificationService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateHandoverOtp, hashHandoverOtp, verifyHandoverOtp } from '../utils/handoverOtp.js';

export const createHandover = asyncHandler(async (req, res) => {
  const claim = await Claim.findById(req.body.claimId).populate('item');
  if (!claim) throw new ApiError(404, 'Claim not found');
  const adminCompletedHandover = req.user.role === 'admin';
  const reporter = claim.item.reporter;
  if (![String(reporter), String(claim.claimant)].includes(String(req.user._id)) && !['admin', 'staff'].includes(req.user.role)) {
    throw new ApiError(403, 'You cannot schedule this handover');
  }
  const existingHandover = await Handover.findOne({ claim: claim._id });
  if (existingHandover) {
    if (!adminCompletedHandover) throw new ApiError(409, 'A handover is already scheduled for this claim');
    const wasCompleted = existingHandover.status === 'completed';
    existingHandover.set({
      staff: req.user._id,
      location: req.body.location,
      date: req.body.date,
      time: req.body.time,
      notes: req.body.notes,
      status: 'completed',
      ownerConfirmed: true,
      finderConfirmed: true,
      staffConfirmed: true,
    });
    await Promise.all([
      existingHandover.save(),
      Item.findByIdAndUpdate(claim.item._id, { status: 'returned', returnedAt: claim.item.returnedAt || new Date() }),
      Claim.updateMany({ item: claim.item._id, _id: { $ne: claim._id }, status: { $in: ['pending', 'under_review', 'approved'] } }, { status: 'closed' }),
      Claim.findByIdAndUpdate(claim._id, { status: 'closed' }),
    ]);
    if (!wasCompleted) {
      await notifyMany([claim.claimant, reporter], {
        title: 'Item returned successfully',
        message: `The handover for “${claim.item.title}” was completed by the campus administrator.`,
        type: 'item_returned', item: claim.item._id, claim: claim._id,
      });
    }
    return res.status(200).json({ success: true, completed: true, handover: existingHandover, message: 'Handover completed. Item marked as returned.' });
  }
  if (claim.status !== 'approved') throw new ApiError(409, 'An approved claim is required');
  const submittedStaffId = typeof req.body.staff === 'string' ? req.body.staff.trim() : req.body.staff;
  const staffId = ['staff', 'admin'].includes(req.user.role) ? req.user._id : submittedStaffId || undefined;
  if (staffId && !mongoose.isValidObjectId(staffId)) {
    throw new ApiError(422, 'Enter a valid staff account ID or leave the optional field blank');
  }
  if (staffId && req.user.role !== 'staff') {
    const validStaff = await User.exists({ _id: staffId, role: { $in: ['staff', 'admin'] }, accountStatus: 'active' });
    if (!validStaff) throw new ApiError(422, 'The selected account is not an active staff member');
  }
  const rawOtp = adminCompletedHandover ? null : generateHandoverOtp();
  const handover = await Handover.create({
    item: claim.item._id,
    claim: claim._id,
    owner: claim.claimant,
    finder: reporter,
    staff: staffId,
    location: req.body.location,
    date: req.body.date,
    time: req.body.time,
    ...(rawOtp ? { OTP: hashHandoverOtp(rawOtp) } : {}),
    status: adminCompletedHandover ? 'completed' : 'scheduled',
    ownerConfirmed: adminCompletedHandover,
    finderConfirmed: adminCompletedHandover,
    staffConfirmed: adminCompletedHandover,
    notes: req.body.notes,
  });

  if (adminCompletedHandover) {
    await Promise.all([
      Item.findByIdAndUpdate(claim.item._id, { status: 'returned', returnedAt: new Date() }),
      Claim.updateMany({ item: claim.item._id, _id: { $ne: claim._id }, status: { $in: ['pending', 'under_review'] } }, { status: 'closed' }),
      Claim.findByIdAndUpdate(claim._id, { status: 'closed' }),
    ]);
    await notifyMany([claim.claimant, reporter], {
      title: 'Item returned successfully',
      message: `The handover for “${claim.item.title}” was completed by the campus administrator.`,
      type: 'item_returned', item: claim.item._id, claim: claim._id,
    });
    return res.status(201).json({ success: true, completed: true, handover, message: 'Handover completed. Item marked as returned.' });
  }

  claim.item.status = 'handover_scheduled';
  await claim.item.save();
  await notify({
    recipient: claim.claimant,
    title: 'Handover scheduled',
    message: `Collection for “${claim.item.title}” is scheduled at ${req.body.location}. The owner’s collection OTP is ${rawOtp}.`,
    type: 'handover_scheduled', item: claim.item._id, claim: claim._id,
  });
  await notify({
    recipient: reporter,
    title: 'Handover scheduled',
    message: `Collection for “${claim.item.title}” is scheduled at ${req.body.location}. The owner will present a private collection OTP.`,
    type: 'handover_scheduled', item: claim.item._id, claim: claim._id,
  });
  const requesterIsOwner = String(req.user._id) === String(claim.claimant);
  res.status(201).json({ success: true, handover, ...(requesterIsOwner ? { collectionOtp: rawOtp } : {}), message: 'Handover scheduled. The OTP was delivered privately to the verified owner.' });
});

export const listHandovers = asyncHandler(async (req, res) => {
  const filter = ['admin', 'staff'].includes(req.user.role)
    ? {}
    : { $or: [{ owner: req.user._id }, { finder: req.user._id }] };
  const handovers = await Handover.find(filter)
    .populate('item', 'title images status reportType')
    .populate('owner finder staff', 'name role profileImage')
    .sort({ date: 1 });
  res.json({ success: true, handovers });
});

export const confirmHandover = asyncHandler(async (req, res) => {
  const handover = await Handover.findById(req.params.id).select('+OTP');
  if (!handover) throw new ApiError(404, 'Handover not found');
  if (handover.status === 'completed') throw new ApiError(409, 'Handover is already complete');

  if (handover.owner.equals(req.user._id)) {
    if (!verifyHandoverOtp(req.body.otp, handover.OTP)) throw new ApiError(400, 'Incorrect handover OTP');
    handover.ownerConfirmed = true;
  } else if (handover.finder.equals(req.user._id)) {
    handover.finderConfirmed = true;
  } else if (['staff', 'admin'].includes(req.user.role)) {
    if (!verifyHandoverOtp(req.body.otp, handover.OTP)) throw new ApiError(400, 'Incorrect handover OTP');
    handover.staffConfirmed = true;
  } else {
    throw new ApiError(403, 'You are not part of this handover');
  }

  if (handover.ownerConfirmed && handover.finderConfirmed && handover.staffConfirmed) {
    handover.status = 'completed';
    await Promise.all([
      Item.findByIdAndUpdate(handover.item, { status: 'returned', returnedAt: new Date() }),
      Claim.updateMany({ item: handover.item, _id: { $ne: handover.claim }, status: { $in: ['pending', 'under_review'] } }, { status: 'closed' }),
      Claim.findByIdAndUpdate(handover.claim, { status: 'closed' }),
    ]);
    await notifyMany([handover.owner, handover.finder], {
      title: 'Item returned successfully',
      message: 'All parties confirmed the handover. This recovery is now complete.',
      type: 'item_returned', item: handover.item, claim: handover.claim,
    });
  } else {
    handover.status = 'ready';
  }
  await handover.save();
  res.json({ success: true, handover, message: handover.status === 'completed' ? 'Item marked as returned' : 'Your confirmation was recorded' });
});
