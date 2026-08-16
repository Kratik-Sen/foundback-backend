import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_IMAGE_SIZE_MB || 5) * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, callback) => {
    if (!allowed.has(file.mimetype)) return callback(new ApiError(415, 'Only JPG, PNG, and WebP images are allowed'));
    callback(null, true);
  },
});
