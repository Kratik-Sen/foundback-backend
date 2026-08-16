import { cloudinary, cloudinaryConfigured } from '../config/cloudinary.js';
import { ApiError } from '../utils/ApiError.js';

function uploadBuffer(file, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
      (error, result) => (error ? reject(error) : resolve({ url: result.secure_url, publicId: result.public_id })),
    );
    stream.end(file.buffer);
  });
}

export async function uploadImages(files = [], folder = 'campusfind/items') {
  if (!files.length) return [];
  if (!cloudinaryConfigured) throw new ApiError(503, 'Image storage is not configured. Add Cloudinary credentials and try again.');
  return Promise.all(files.map((file) => uploadBuffer(file, folder)));
}

export async function deleteImages(images = []) {
  if (!cloudinaryConfigured) return;
  await Promise.allSettled(images.filter((image) => image.publicId).map((image) => cloudinary.uploader.destroy(image.publicId)));
}
