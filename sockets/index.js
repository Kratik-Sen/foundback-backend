import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { notify, setNotificationSocket } from '../services/notificationService.js';

function extractToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;
  const cookies = cookie.parse(socket.handshake.headers.cookie || '');
  return cookies.campusfind_token;
}

export function configureSockets(io) {
  const onlineSockets = new Map();
  const isUserOnline = (userId) => Boolean(onlineSockets.get(String(userId))?.size);
  const emitPresence = async (userId, online) => {
    const chats = await Chat.find({ participants: userId }).select('participants');
    const contacts = new Set(chats.flatMap((chat) => chat.participants.map(String)).filter((id) => id !== String(userId)));
    for (const contactId of contacts) io.to(`user:${contactId}`).emit('presence:update', { userId: String(userId), online });
  };

  io.isUserOnline = isUserOnline;
  setNotificationSocket(io);
  io.use(async (socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub);
      if (!user || user.accountStatus !== 'active') return next(new Error('Account unavailable'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid session'));
    }
  });

  io.on('connection', (socket) => {
    const userId = String(socket.user._id);
    const userSockets = onlineSockets.get(userId) || new Set();
    const wasOffline = userSockets.size === 0;
    userSockets.add(socket.id);
    onlineSockets.set(userId, userSockets);
    socket.join(`user:${userId}`);
    if (wasOffline) emitPresence(userId, true).catch(() => {});

    socket.on('chat:join', async (chatId, acknowledge = () => {}) => {
      try {
        const chat = await Chat.findById(chatId);
        const allowed = chat?.participants.some((id) => id.equals(socket.user._id)) || socket.user.role === 'admin';
        if (!allowed) throw new Error('Chat access denied');
        const roomName = `chat:${chatId}`;
        for (const room of socket.rooms) {
          if (room.startsWith('chat:') && room !== roomName) socket.leave(room);
        }
        await socket.join(roomName);
        const otherUserId = chat.participants.map(String).find((id) => id !== userId);
        acknowledge({ success: true, otherUserId, otherOnline: otherUserId ? isUserOnline(otherUserId) : false });
      } catch (error) { acknowledge({ success: false, message: error.message }); }
    });

    socket.on('chat:leave', (chatId) => {
      if (chatId) socket.leave(`chat:${chatId}`);
    });

    socket.on('typing:start', ({ chatId } = {}) => {
      const roomName = `chat:${chatId}`;
      if (chatId && socket.rooms.has(roomName)) {
        socket.to(roomName).emit('typing:start', { chatId, userId: socket.user._id, name: socket.user.name });
      }
    });
    socket.on('typing:stop', ({ chatId } = {}) => {
      const roomName = `chat:${chatId}`;
      if (chatId && socket.rooms.has(roomName)) {
        socket.to(roomName).emit('typing:stop', { chatId, userId: socket.user._id });
      }
    });

    socket.on('message:send', async ({ chatId, message }, acknowledge = () => {}) => {
      try {
        const cleanMessage = message?.trim();
        const chat = await Chat.findOne({ _id: chatId, participants: socket.user._id, status: { $ne: 'blocked' } });
        if (!chat || !cleanMessage) throw new Error('Message could not be sent');
        if (cleanMessage.length > 3000) throw new Error('Message must be 3000 characters or fewer');
        const created = await Message.create({ chat: chatId, sender: socket.user._id, message: cleanMessage, readBy: [socket.user._id] });
        chat.lastMessage = created._id;
        await chat.save();
        await created.populate('sender', 'name role profileImage');
        const roomName = `chat:${chatId}`;
        await socket.join(roomName);
        io.to(roomName).emit('message:new', created);
        acknowledge({ success: true, message: created });
        const recipient = chat.participants.find((id) => !id.equals(socket.user._id));
        if (recipient) {
          io.to(`user:${recipient}`).emit('chat:unread-changed', { chatId: chat._id });
          notify({ recipient, title: 'New chat message', message: `${socket.user.name}: ${created.message}`, type: 'chat_message', item: chat.item, claim: chat.claim }).catch(() => {});
        }
      } catch (error) { acknowledge({ success: false, message: error.message }); }
    });

    socket.on('disconnect', () => {
      const currentSockets = onlineSockets.get(userId);
      if (!currentSockets) return;
      currentSockets.delete(socket.id);
      if (currentSockets.size) return;
      onlineSockets.delete(userId);
      emitPresence(userId, false).catch(() => {});
    });
  });
}
