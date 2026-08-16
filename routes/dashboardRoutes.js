import { Router } from 'express';
import { staffDashboard, dashboardStats } from '../controllers/adminController.js';
import { studentDashboard } from '../controllers/dashboardController.js';
import { protect } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();
router.use(protect);
router.get('/student', studentDashboard);
router.get('/staff', allowRoles('staff', 'admin'), staffDashboard);
router.get('/admin', allowRoles('admin'), dashboardStats);

export default router;
