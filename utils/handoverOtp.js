import crypto from 'node:crypto';

export const hashHandoverOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');
export const verifyHandoverOtp = (otp, expectedHash) => Boolean(otp) && crypto.timingSafeEqual(Buffer.from(hashHandoverOtp(otp)), Buffer.from(expectedHash));
export const generateHandoverOtp = () => String(Math.floor(100000 + Math.random() * 900000));
