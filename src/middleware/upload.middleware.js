import multer from 'multer';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';

/**
 * Enterprise Multer Storage Configuration
 * Using Memory Storage for serverless/container compatibility (Direct stream to Cloudinary)
 */
const storage = multer.memoryStorage();

const uploadMiddleware = multer({
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024,  // 10MB max file size
    files: 5,                     // Max 5 files per request
    fields: 10,                   // Max 10 non-file fields
    parts: 15                     // Max 15 total parts (files + fields)
  },
  fileFilter: (req, file, cb) => {
    // Whitelist for common enterprise attachment types
    const allowedTypes = [
      'image/', 
      'video/',
      'audio/', 
      'application/pdf', 
      'application/zip', 
      'application/x-zip-compressed',
      'application/vnd.rar', 
      'application/x-rar-compressed',
      'text/plain', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type));
    
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new AppError(`File type ${file.mimetype} is not allowed for security reasons.`, HTTP_STATUS.BAD_REQUEST, 'FILE_TYPE_ERROR'), false);
    }
  }
});

export default uploadMiddleware;
