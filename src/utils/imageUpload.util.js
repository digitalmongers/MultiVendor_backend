import axios from 'axios';
import { uploadToCloudinary } from './cloudinary.js';
import Logger from './logger.js';
import AppError from './AppError.js';
import { HTTP_STATUS } from '../constants.js';

/**
 * Upload image from URL to Cloudinary
 * Downloads image from URL and uploads to Cloudinary
 * 
 * @param {string} imageUrl - Publicly accessible image URL
 * @param {string} folder - Cloudinary folder path
 * @param {object} options - Additional Cloudinary options
 * @returns {Promise<{url: string, publicId: string}>}
 */
export const uploadImageFromUrl = async (imageUrl, folder = 'multi-vendor', options = {}) => {
    try {
        if (!imageUrl || typeof imageUrl !== 'string') {
            throw new Error('Invalid image URL');
        }

        // Validate URL format
        const urlPattern = /^https?:\/\/.+/i;
        if (!urlPattern.test(imageUrl)) {
            throw new Error('Invalid URL format. Must start with http:// or https://');
        }

        // Download image from URL with timeout
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 5000, // 5 seconds timeout
            maxContentLength: 10 * 1024 * 1024, // 10MB max
            headers: {
                'User-Agent': 'MultiVendor-BulkImport/1.0'
            }
        });

        // Validate content type
        const contentType = response.headers['content-type'];
        const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];

        if (!validImageTypes.includes(contentType)) {
            throw new Error(`Invalid image type: ${contentType}. Supported: JPEG, PNG, WebP, GIF`);
        }

        // Create buffer from response
        const buffer = Buffer.from(response.data);

        // Upload to Cloudinary
        const result = await uploadToCloudinary(
            { buffer },
            folder,
            {
                quality: 'auto:good',
                fetch_format: 'auto',
                ...options
            }
        );

        return {
            url: result.secure_url,
            publicId: result.public_id
        };

    } catch (error) {
        // Log error but don't throw - allow product creation without images
        Logger.error('Image upload from URL failed', {
            imageUrl,
            error: error.message,
            stack: error.stack
        });

        // Re-throw for critical errors
        if (error.code === 'ECONNABORTED') {
            throw new AppError('Image download timeout. URL may be slow or inaccessible.', HTTP_STATUS.BAD_REQUEST);
        }

        if (error.response?.status === 404) {
            throw new AppError('Image not found at provided URL.', HTTP_STATUS.BAD_REQUEST);
        }

        if (error.response?.status === 403 || error.response?.status === 401) {
            throw new AppError('Image URL requires authentication. Please use publicly accessible URLs.', HTTP_STATUS.BAD_REQUEST);
        }

        throw new AppError(`Failed to upload image: ${error.message}`, HTTP_STATUS.BAD_REQUEST);
    }
};

/**
 * Upload multiple images from URLs to Cloudinary
 * Processes images in parallel with concurrency limit
 * 
 * @param {string[]} imageUrls - Array of image URLs
 * @param {string} folder - Cloudinary folder path
 * @param {number} concurrency - Maximum concurrent uploads (default: 5)
 * @returns {Promise<Array<{url: string, publicId: string}>>}
 */
export const uploadMultipleImagesFromUrls = async (imageUrls, folder = 'multi-vendor', concurrency = 5) => {
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        return [];
    }

    // Filter out empty/invalid URLs
    const validUrls = imageUrls.filter(url => url && typeof url === 'string' && url.trim().length > 0);

    if (validUrls.length === 0) {
        return [];
    }

    // Limit to prevent abuse
    const maxImages = 20;
    if (validUrls.length > maxImages) {
        Logger.warn(`Too many images provided (${validUrls.length}). Limiting to ${maxImages}`);
        validUrls.splice(maxImages);
    }

    const results = [];
    const errors = [];

    // Process in batches to limit concurrency
    for (let i = 0; i < validUrls.length; i += concurrency) {
        const batch = validUrls.slice(i, i + concurrency);

        const batchResults = await Promise.allSettled(
            batch.map(url => uploadImageFromUrl(url, folder))
        );

        batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            } else {
                const url = batch[index];
                errors.push({ url, error: result.reason?.message || 'Unknown error' });
                Logger.warn('Image upload failed in batch', { url, error: result.reason?.message });
            }
        });
    }

    // Log summary
    if (errors.length > 0) {
        Logger.warn('Some images failed to upload', {
            total: validUrls.length,
            successful: results.length,
            failed: errors.length,
            errors
        });
    }

    return results;
};

/**
 * Delete multiple images from Cloudinary
 * Used for cleanup on transaction rollback
 * 
 * @param {string[]} publicIds - Array of Cloudinary public IDs
 */
export const deleteMultipleImages = async (publicIds) => {
    if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
        return;
    }

    const { deleteFromCloudinary } = await import('./cloudinary.js');

    const results = await Promise.allSettled(
        publicIds.map(publicId => deleteFromCloudinary(publicId))
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
        Logger.error('Some images failed to delete from Cloudinary', {
            total: publicIds.length,
            failed: failed.length
        });
    }
};
