import { Router } from 'express';
import * as notifications from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { objectIdValidator } from '../validators/itemValidators.js';

const router = Router();
router.use(protect);
router.get('/', notifications.getNotifications);
router.patch('/read-all', notifications.markAllRead);
router.patch('/:id/read', objectIdValidator(), validate, notifications.markNotificationRead);
router.delete('/:id', objectIdValidator(), validate, notifications.deleteNotification);

export default router;
