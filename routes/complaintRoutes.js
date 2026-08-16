import { Router } from 'express';
import * as complaints from '../controllers/complaintController.js';
import { protect } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = Router();
router.use(protect);
router.get('/mine', complaints.myComplaints);
router.post('/', upload.array('screenshots', 1), complaints.createComplaint);

export default router;
