import multer from 'multer';
import AppError from './AppError.js';
import { HTTP_STATUS } from '../constants.js';

/**
 * Multer configuration for file uploads
 * Uses memory storage for temporary file handling
 */

// Memory storage - files stored as Buffer in memory
const storage = multer.memoryStorage();

// File filter for Excel files
const excelFileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel' // .xls
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError('Invalid file type. Only Excel files (.xlsx, .xls) are allowed.', HTTP_STATUS.BAD_REQUEST), false);
    }
};

// File filter for images
const imageFileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError('Invalid file type. Only images (JPEG, PNG, WebP, GIF) are allowed.', HTTP_STATUS.BAD_REQUEST), false);
    }
};

/**
 * Multer upload instance for Excel files
 * Max file size: 5MB
 */
export const uploadExcel = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: excelFileFilter
});

/**
 * Multer upload instance for images
 * Max file size: 10MB
 */
export const uploadImage = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: imageFileFilter
});

/**
 * Multer upload instance for any file type
 * Max file size: 10MB
 * Use with caution - validate file type in controller
 */
export const uploadAny = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});
