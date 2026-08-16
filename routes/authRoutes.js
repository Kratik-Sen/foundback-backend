import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as auth from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { forgotPasswordValidator, loginValidator, registerValidator, resetPasswordValidator } from '../validators/authValidators.js';

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  skip: () => process.env.NODE_ENV !== 'production',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts. Try again later.' },
});

router.post('/register', upload.single('profileImage'), registerValidator, validate, auth.register);
router.post('/login', loginLimiter, loginValidator, validate, auth.login);
router.post('/logout', auth.logout);
router.post('/verify-email', auth.verifyEmail);
router.post('/forgot-password', forgotPasswordValidator, validate, auth.forgotPassword);
router.post('/reset-password', resetPasswordValidator, validate, auth.resetPassword);
router.get('/me', protect, auth.me);
router.patch('/profile', protect, upload.single('profileImage'), auth.updateProfile);
router.patch('/change-password', protect, auth.changePassword);

export default router;
