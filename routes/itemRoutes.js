import { Router } from 'express';
import * as items from '../controllers/itemController.js';
import { optionalAuth, protect } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { itemValidator, objectIdValidator, updateItemValidator } from '../validators/itemValidators.js';

const router = Router();

router.get('/', items.listItems);
router.post('/', protect, upload.array('images', 6), itemValidator, validate, items.createItem);
router.get('/mine', protect, items.myItems);
router.get('/matches', protect, items.getMatches);
router.get('/bookmarks', protect, items.getBookmarks);
router.get('/:id/qr', objectIdValidator(), validate, items.itemQrCode);
router.post('/:id/bookmark', protect, objectIdValidator(), validate, items.bookmarkItem);
router.delete('/:id/bookmark', protect, objectIdValidator(), validate, items.removeBookmark);
router.post('/:id/extend', protect, objectIdValidator(), validate, items.extendItem);
router.patch('/:id/recovered', protect, objectIdValidator(), validate, items.markRecovered);
router.get('/:id', optionalAuth, objectIdValidator(), validate, items.getItem);
router.patch('/:id', protect, upload.array('images', 6), objectIdValidator(), updateItemValidator, validate, items.updateItem);
router.delete('/:id', protect, objectIdValidator(), validate, items.deleteItem);

export default router;
