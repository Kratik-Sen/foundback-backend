import User from '../models/User.js';
import { escapeEmailHtml, sendEmail } from '../services/emailService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publicUser } from '../utils/serializers.js';
import { hashToken, randomToken, setAuthCookie, signToken } from '../utils/token.js';
import { pick } from '../utils/request.js';
import { deleteImages, uploadImages } from '../services/cloudinaryService.js';

function emailAllowed(email) {
  const domains = (process.env.COLLEGE_EMAIL_DOMAIN || '')
    .split(',').map((domain) => domain.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_TEST_EMAILS === 'true') return true;
  return domains.some((domain) => email.toLowerCase().endsWith(`@${domain}`));
}

export const register = asyncHandler(async (req, res) => {
  if (!emailAllowed(req.body.email)) throw new ApiError(422, 'Please use an approved college email address');
  const exists = await User.findOne({ $or: [{ email: req.body.email }, { enrollmentNumber: req.body.enrollmentNumber.toUpperCase() }] });
  if (exists) throw new ApiError(409, 'An account with that email or enrollment number already exists');

  const { raw, hash } = randomToken();
  const profileImages = await uploadImages(req.file ? [req.file] : [], 'campusfind/profiles');
  const user = await User.create({
    ...pick(req.body, ['name', 'email', 'enrollmentNumber', 'phone', 'course', 'branch', 'semester', 'password']),
    role: 'student',
    profileImage: profileImages[0],
    verificationToken: hash,
    verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${raw}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your FoundBack email',
    text: `Verify your account: ${verificationUrl}`,
    html: `<p>Welcome to FoundBack, ${escapeEmailHtml(user.name)}.</p><p><a href="${verificationUrl}">Verify your college email</a></p>`,
  });
  const token = signToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ success: true, user: publicUser(user), message: 'Account created. Check your email to verify it.' });
});

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+password');
  if (!user || !(await user.comparePassword(req.body.password))) throw new ApiError(401, 'Invalid email or password');
  if (user.accountStatus === 'blocked') throw new ApiError(403, 'This account has been blocked. Contact the administrator.');
  if (user.accountStatus === 'suspended') throw new ApiError(403, 'This account is suspended');
  if (!user.emailVerified && process.env.NODE_ENV === 'production') throw new ApiError(403, 'Verify your college email before signing in');
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });
  setAuthCookie(res, signToken(user));
  res.json({ success: true, user: publicUser(user), message: 'Welcome back' });
});

export function logout(_req, res) {
  res.clearCookie('campusfind_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
  res.json({ success: true, message: 'Signed out successfully' });
}

export const me = asyncHandler(async (req, res) => res.json({ success: true, user: publicUser(req.user) }));

export const verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({ verificationToken: hashToken(req.body.token), verificationExpires: { $gt: new Date() } })
    .select('+verificationToken +verificationExpires');
  if (!user) throw new ApiError(400, 'Verification link is invalid or expired');
  user.emailVerified = true;
  user.verificationToken = undefined;
  user.verificationExpires = undefined;
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, message: 'Email verified successfully' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user) {
    const { raw, hash } = randomToken();
    user.resetPasswordToken = hash;
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${raw}`;
    await sendEmail({ to: user.email, subject: 'Reset your FoundBack password', text: resetUrl, html: `<p><a href="${resetUrl}">Reset your password</a>. This link expires in 30 minutes.</p>` });
  }
  res.json({ success: true, message: 'If that account exists, a reset link has been sent.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ resetPasswordToken: hashToken(req.body.token), resetPasswordExpires: { $gt: new Date() } })
    .select('+password +resetPasswordToken +resetPasswordExpires');
  if (!user) throw new ApiError(400, 'Reset link is invalid or expired');
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  setAuthCookie(res, signToken(user));
  res.json({ success: true, user: publicUser(user), message: 'Password reset successfully' });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const updates = pick(req.body, ['name', 'phone', 'course', 'branch']);
  Object.assign(req.user, updates);

  if (Object.hasOwn(req.body, 'semester')) {
    const rawSemester = req.body.semester;
    if (rawSemester === '' || rawSemester === null || rawSemester === 'null') {
      req.user.semester = undefined;
    } else {
      const semester = Number(rawSemester);
      if (!Number.isInteger(semester) || semester < 1 || semester > 12) {
        throw new ApiError(422, 'Choose a semester between 1 and 12');
      }
      req.user.semester = semester;
    }
  }
  if (req.file) {
    const [profileImage] = await uploadImages([req.file], 'campusfind/profiles');
    await deleteImages(req.user.profileImage?.url ? [req.user.profileImage] : []);
    req.user.profileImage = profileImage;
  }
  await req.user.save();
  res.json({ success: true, user: publicUser(req.user), message: 'Profile updated' });
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) throw new ApiError(400, 'Current password is incorrect');
  if (!req.body.newPassword || req.body.newPassword.length < 8) throw new ApiError(422, 'New password must contain at least 8 characters');
  user.password = req.body.newPassword;
  await user.save();
  setAuthCookie(res, signToken(user));
  res.json({ success: true, message: 'Password changed successfully' });
});
