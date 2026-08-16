import { body, param } from 'express-validator';

export const objectIdValidator = (field = 'id') => param(field).isMongoId().withMessage('Invalid resource identifier');

export const itemValidator = [
  body('reportType').isIn(['lost', 'found']).withMessage('Choose lost or found'),
  body('title').trim().isLength({ min: 3, max: 120 }).withMessage('Title must contain 3 to 120 characters'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('description').trim().isLength({ min: 10, max: 3000 }).withMessage('Description must contain at least 10 characters'),
  body('date').isISO8601().custom((value) => new Date(value) <= new Date()).withMessage('Date cannot be in the future'),
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('reward').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Reward cannot be negative'),
  body('verificationQuestions').optional().custom((value) => {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(parsed) && parsed.length <= 5;
    } catch { return false; }
  }).withMessage('Verification questions must be an array with at most five entries'),
];

export const updateItemValidator = [
  body('title').optional().trim().isLength({ min: 3, max: 120 }),
  body('description').optional().trim().isLength({ min: 10, max: 3000 }),
  body('date').optional().isISO8601().custom((value) => new Date(value) <= new Date()),
  body('retainedImageIds').optional().custom((value) => {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(parsed) && parsed.length <= 6 && parsed.every((entry) => typeof entry === 'string');
    } catch { return false; }
  }).withMessage('Retained images must be an array with at most six entries'),
];
