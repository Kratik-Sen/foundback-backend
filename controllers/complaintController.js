import Chat from '../models/Chat.js';
import Complaint from '../models/Complaint.js';
import Message from '../models/Message.js';
import { uploadImages } from '../services/cloudinaryService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createComplaint = asyncHandler(async (req, res) => {
  let reportedChat;
  if (req.body.chat) {
    reportedChat = await Chat.findOne({ _id: req.body.chat, participants: req.user._id });
    if (!reportedChat) throw new ApiError(403, 'You can only report a chat you participate in');
  }
  const screenshots = await uploadImages(req.files || [], 'campusfind/complaints');
  const complaint = await Complaint.create({
    reportedBy: req.user._id,
    reportedUser: req.body.reportedUser,
    item: req.body.item,
    claim: req.body.claim,
    chat: req.body.chat,
    reportType: req.body.reportType,
    description: req.body.description,
    screenshot: screenshots[0],
  });
  if (reportedChat) {
    reportedChat.status = 'reported';
    await reportedChat.save();
    await Message.updateMany({ chat: reportedChat._id }, { reported: true });
  }
  res.status(201).json({ success: true, complaint, message: 'Report submitted for admin review' });
});

export const myComplaints = asyncHandler(async (req, res) => {
  const complaints = await Complaint.find({ reportedBy: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, complaints });
});
