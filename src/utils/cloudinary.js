import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';
import Logger from './logger.js';

/**
 * Utility: Upload Buffer to Cloudinary using Streams
 */
export const uploadToCloudinary = (file, folder = 'multi-vendor', options = {}) => {
  return new Promise((resolve, reject) => {
    const buffer = file.buffer;
    if (!buffer) return reject(new Error('No file buffer provided'));

    const uploadOptions = {
      folder,
      resource_type: 'auto',
      quality: 'auto:good',
      fetch_format: 'auto',
      ...options,
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

/**
 * Utility: Delete from Cloudinary
 */
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    if (!publicId) return null;
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    Logger.error('Cloudinary Deletion Failed', { publicId, error: error.message });
    return null;
  }
};
