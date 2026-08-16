import { Router } from 'express';
import * as chats from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { objectIdValidator } from '../validators/itemValidators.js';

const router = Router();
router.use(protect);
router.get('/', chats.getChats);
router.get('/unread-count', chats.getUnreadCount);
router.post('/items/:itemId/contact', objectIdValidator('itemId'), validate, chats.startItemContact);
router.get('/:id', objectIdValidator(), validate, chats.getChat);
router.get('/:id/messages', objectIdValidator(), validate, chats.getMessages);
router.post('/:id/messages', upload.array('images', 1), objectIdValidator(), validate, chats.sendMessage);
router.patch('/:id/read', objectIdValidator(), validate, chats.markRead);
router.patch('/:id/block', objectIdValidator(), validate, chats.blockChat);

export default router;
