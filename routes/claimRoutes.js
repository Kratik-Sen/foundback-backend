import { Router } from 'express';
import * as claims from '../controllers/claimController.js';
import { protect } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { claimValidator, reviewClaimValidator } from '../validators/claimValidators.js';
import { objectIdValidator } from '../validators/itemValidators.js';

const router = Router();
router.use(protect);

router.get('/', allowRoles('staff', 'admin'), claims.allClaims);
router.get('/mine', claims.myClaims);
router.post('/item/:itemId', upload.array('proofImages', 3), objectIdValidator('itemId'), claimValidator, validate, claims.createClaim);
router.get('/item/:itemId', objectIdValidator('itemId'), validate, claims.itemClaims);
router.get('/:id', objectIdValidator(), validate, claims.getClaim);
router.patch('/:id/review', allowRoles('staff', 'admin'), objectIdValidator(), reviewClaimValidator, validate, claims.reviewClaim);
router.patch('/:id/cancel', objectIdValidator(), validate, claims.cancelClaim);

export default router;
