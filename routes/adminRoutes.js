import { Router } from 'express';
import * as admin from '../controllers/adminController.js';
import { allClaims, reviewClaim } from '../controllers/claimController.js';
import { protect } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { reviewClaimValidator } from '../validators/claimValidators.js';
import { objectIdValidator } from '../validators/itemValidators.js';

const router = Router();
router.use(protect, allowRoles('admin'));

router.get('/stats', admin.dashboardStats);
router.get('/users', admin.listUsers);
router.post('/users', admin.createManagedUser);
router.patch('/users/:id', objectIdValidator(), validate, admin.updateUser);
router.get('/items', admin.listAllItems);
router.get('/claims', allClaims);
router.patch('/claims/:id/review', objectIdValidator(), reviewClaimValidator, validate, reviewClaim);
router.get('/complaints', admin.listComplaints);
router.patch('/complaints/:id', objectIdValidator(), validate, admin.reviewComplaint);
router.get('/contact-messages', admin.listContactMessages);
router.patch('/contact-messages/:id', objectIdValidator(), validate, admin.updateContactMessage);
router.get('/categories', admin.categories.list);
router.post('/categories', admin.categories.create);
router.patch('/categories/:id', objectIdValidator(), validate, admin.categories.update);
router.delete('/categories/:id', objectIdValidator(), validate, admin.categories.remove);
router.get('/locations', admin.locations.list);
router.post('/locations', admin.locations.create);
router.patch('/locations/:id', objectIdValidator(), validate, admin.locations.update);
router.delete('/locations/:id', objectIdValidator(), validate, admin.locations.remove);
router.get('/announcements', admin.listAnnouncements);
router.post('/announcements', admin.createAnnouncement);
router.get('/logs', admin.listLogs);
router.get('/settings', admin.listSettings);
router.put('/settings/:key', admin.updateSetting);
router.get('/export/items.csv', admin.exportItemsCsv);

export default router;
