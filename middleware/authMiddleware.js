import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, _res, next) => {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = req.cookies?.campusfind_token || bearer;
  if (!token) throw new ApiError(401, 'Please sign in to continue');

  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'This account no longer exists');
  if (user.accountStatus === 'blocked') throw new ApiError(403, 'This account has been blocked');
  if (user.accountStatus === 'suspended') throw new ApiError(403, 'This account is suspended');
  req.user = user;
  next();
});

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.campusfind_token || req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(payload.sub);
  } catch {
    req.user = null;
  }
  next();
});
