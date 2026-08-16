import { body } from 'express-validator';

export const claimValidator = [
  body('reason').trim().isLength({ min: 10 }).withMessage('Explain why this item belongs to you'),
  body('uniqueIdentificationAnswer').trim().notEmpty().withMessage('Unique identification details are required'),
  body('locationAnswer').trim().notEmpty().withMessage('Exact loss location is required'),
  body('dateAnswer').isISO8601().withMessage('Approximate loss date is required'),
  body('verificationAnswers').optional().custom((value) => {
    try { return Array.isArray(typeof value === 'string' ? JSON.parse(value) : value); } catch { return false; }
  }).withMessage('Verification answers must be an array'),
];

export const reviewClaimValidator = [
  body('decision').isIn(['approve', 'reject']),
  body('rejectionReason').if(body('decision').equals('reject')).trim().notEmpty().withMessage('A rejection reason is required'),
];
