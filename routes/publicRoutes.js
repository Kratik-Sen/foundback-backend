import { Router } from 'express';
import { contact, home, metadata } from '../controllers/publicController.js';

const router = Router();
router.get('/home', home);
router.get('/metadata', metadata);
router.post('/contact', contact);

export default router;
