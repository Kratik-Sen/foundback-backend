import Chat from '../models/Chat.js';
import Claim from '../models/Claim.js';
import Item from '../models/Item.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import { uploadImages } from '../services/cloudinaryService.js';
import { notify } from '../services/notificationService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination } from '../utils/query.js';

async function accessibleChat(chatId, user) {
  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, 'Chat not found');
  if (!chat.participants.some((id) => id.equals(user._id)) && user.role !== 'admin') throw new ApiError(403, 'You are not a participant in this chat');
  return chat;
}

async function participantIsViewing(io, chat, userId) {
  if (chat.isActivelyViewedBy(userId)) return true;
  if (!io) return false;
  try {
    const sockets = await io.in(`user:${userId}`).fetchSockets();
    return sockets.some((socket) => socket.rooms.has(`chat:${chat._id}`));
  } catch {
    return false;
  }
}

async function markChatReadFor(chat, userId, io) {
  await Promise.all([
    Message.updateMany({ chat: chat._id, readBy: { $ne: userId } }, { $addToSet: { readBy: userId } }),
    Notification.deleteMany({ recipient: userId, type: 'chat_message', chat: chat._id }),
  ]);
  io?.to(`chat:${chat._id}`).emit('messages:read', { chatId: chat._id, userId });
  io?.to(`user:${userId}`).emit('chat:unread-changed', { chatId: chat._id });
}

export const startItemContact = asyncHandler(async (req, res) => {
  const item = await Item.findOne({ _id: req.params.itemId, approvalStatus: 'approved' });
  if (!item) throw new ApiError(404, 'Active item report not found');
  if (item.reporter.equals(req.user._id)) throw new ApiError(403, 'You cannot start a chat with yourself');
  if (['returned', 'closed', 'expired'].includes(item.status)) throw new ApiError(409, 'This item report is no longer accepting messages');

  const participantIds = [String(req.user._id), String(item.reporter)].sort();
  const contactKey = `${item._id}:${participantIds.join(':')}`;
  let chat;
  let linkedClaim;
  if (item.reportType === 'found') {
    linkedClaim = await Claim.findOne({ item: item._id, claimant: req.user._id, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 });
    if (linkedClaim) chat = await Chat.findOne({ claim: linkedClaim._id });
  }
  if (!chat) chat = await Chat.findOne({ contactKey });
  if (chat && linkedClaim && !chat.claim) {
    chat.claim = linkedClaim._id;
    chat.kind = 'claim';
    await chat.save();
  }
  let created = false;

  if (!chat) {
    try {
      chat = await Chat.create({
        item: item._id,
        participants: [req.user._id, item.reporter],
        claim: linkedClaim?._id,
        kind: linkedClaim ? 'claim' : 'item_contact',
        contactKey,
      });
      created = true;
    } catch (error) {
      if (error.code !== 11000) throw error;
      chat = await Chat.findOne({ contactKey });
    }
  }

  if (created) {
    const notificationTitle = item.reportType === 'lost'
      ? 'Someone may have found your item'
      : 'Someone may own the item you found';
    await notify({
      recipient: item.reporter,
      title: notificationTitle,
      message: `${req.user.name} opened a secure chat about “${item.title}”.`,
      type: 'item_contact_started',
      item: item._id,
    });
  }

  res.status(created ? 201 : 200).json({
    success: true,
    chatId: chat._id,
    message: created ? 'Secure chat started' : 'Opening your existing chat',
  });
});

export const getChats = asyncHandler(async (req, res) => {
  const chats = await Chat.find({ participants: req.user._id })
    .populate('participants', 'name role profileImage')
    .populate('item', 'title images status')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });
  const chatIds = chats.map((chat) => chat._id);
  const unreadRows = chatIds.length ? await Message.aggregate([
    { $match: { chat: { $in: chatIds }, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } } },
    { $group: { _id: '$chat', count: { $sum: 1 } } },
  ]) : [];
  const unreadByChat = new Map(unreadRows.map((entry) => [String(entry._id), entry.count]));
  const results = chats.map((chat) => ({ ...chat.toJSON(), unreadCount: unreadByChat.get(String(chat._id)) || 0 }));
  const unread = unreadRows.reduce((total, entry) => total + entry.count, 0);
  res.json({ success: true, chats: results, unread });
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const chatIds = await Chat.find({ participants: req.user._id }).distinct('_id');
  const unread = chatIds.length ? await Message.countDocuments({
    chat: { $in: chatIds },
    sender: { $ne: req.user._id },
    readBy: { $ne: req.user._id },
  }) : 0;
  res.json({ success: true, unread });
});

export const getChat = asyncHandler(async (req, res) => {
  const chat = await accessibleChat(req.params.id, req.user);
  await chat.populate('participants', 'name role profileImage');
  await chat.populate('item', 'title images status');
  res.json({ success: true, chat });
});

export const getMessages = asyncHandler(async (req, res) => {
  await accessibleChat(req.params.id, req.user);
  const { page, limit, skip } = pagination({ ...req.query, limit: req.query.limit || 30 });
  const [messages, total] = await Promise.all([
    Message.find({ chat: req.params.id }).populate('sender', 'name role profileImage').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Message.countDocuments({ chat: req.params.id }),
  ]);
  res.json({ success: true, messages: messages.reverse(), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const chat = await accessibleChat(req.params.id, req.user);
  if (chat.status === 'blocked') throw new ApiError(403, 'This chat has been blocked');
  const uploads = await uploadImages(req.files || [], 'campusfind/chat');
  if (!req.body.message?.trim() && !uploads.length) throw new ApiError(422, 'Write a message or attach an image');
  const io = req.app.get('io');
  const recipient = chat.participants.find((id) => !id.equals(req.user._id));
  const recipientViewing = recipient ? await participantIsViewing(io, chat, recipient) : false;
  const readBy = recipientViewing ? [req.user._id, recipient] : [req.user._id];
  const message = await Message.create({
    chat: chat._id, sender: req.user._id, message: req.body.message?.trim(), image: uploads[0], readBy,
  });
  chat.lastMessage = message._id;
  await chat.save();
  await message.populate('sender', 'name role profileImage');
  io?.to(`chat:${chat._id}`).emit('message:new', message);
  if (recipient) {
    io?.to(`user:${recipient}`).emit('chat:unread-changed', { chatId: chat._id });
    if (!recipientViewing) {
      await notify({ recipient, title: 'New chat message', message: `${req.user.name}: ${message.message || 'Sent an image'}`, type: 'chat_message', item: chat.item, claim: chat.claim, chat: chat._id });
    }
  }
  res.status(201).json({ success: true, message });
});

export const markRead = asyncHandler(async (req, res) => {
  const chat = await accessibleChat(req.params.id, req.user);
  const io = req.app.get('io');
  await markChatReadFor(chat, req.user._id, io);
  res.json({ success: true });
});

export const setActive = asyncHandler(async (req, res) => {
  const chat = await accessibleChat(req.params.id, req.user);
  const active = req.body.active !== false;
  await Chat.updateOne(
    { _id: chat._id },
    { $pull: { activeViewers: { user: req.user._id } } },
    { timestamps: false },
  );
  if (active) {
    await Chat.updateOne(
      { _id: chat._id },
      { $push: { activeViewers: { user: req.user._id, lastSeenAt: new Date() } } },
      { timestamps: false },
    );
  }
  if (active) await markChatReadFor(chat, req.user._id, req.app.get('io'));
  res.json({ success: true, active });
});

export const blockChat = asyncHandler(async (req, res) => {
  const chat = await accessibleChat(req.params.id, req.user);
  if (chat.status === 'blocked' && chat.blockedBy && !chat.blockedBy.equals(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(403, 'Only the person who blocked this chat can unblock it');
  }
  const unblocking = chat.status === 'blocked';
  chat.status = unblocking ? 'active' : 'blocked';
  chat.blockedBy = chat.status === 'blocked' ? req.user._id : undefined;
  await chat.save();
  const statusUpdate = {
    chatId: chat._id,
    status: chat.status,
    blockedBy: chat.blockedBy || null,
  };
  req.app.get('io')?.to(`chat:${chat._id}`).emit('chat:status', statusUpdate);
  res.json({
    success: true,
    chat,
    message: unblocking ? 'User unblocked. You can send messages again.' : 'User blocked. Neither participant can send messages until you unblock them.',
  });
});

export { accessibleChat };
