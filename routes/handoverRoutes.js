import { Router } from 'express';
import * as handovers from '../controllers/handoverController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { objectIdValidator } from '../validators/itemValidators.js';

const router = Router();
router.use(protect);
router.get('/', handovers.listHandovers);
router.post('/', handovers.createHandover);
router.patch('/:id/confirm', objectIdValidator(), validate, handovers.confirmHandover);

export default router;
