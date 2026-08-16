import { body } from 'express-validator';

export const registerValidator = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Full name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Enter a valid college email'),
  body('enrollmentNumber').trim().notEmpty().withMessage('Enrollment number is required'),
  body('phone').optional({ checkFalsy: true }).matches(/^[0-9+ -]{7,18}$/).withMessage('Enter a valid phone number'),
  body('password').isLength({ min: 8 }).withMessage('Password must contain at least 8 characters'),
  body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
];

export const loginValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const forgotPasswordValidator = [body('email').isEmail().normalizeEmail()];

export const resetPasswordValidator = [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
  body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
];
