import express from 'express';
import uploadMiddleware from '../middleware/upload.middleware.js';
import { uploadSingle, uploadMultiple, uploadFields } from '../controllers/upload.controller.js';
import { adminProtect } from '../middleware/adminAuth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: File upload management
 */

// All upload routes are protected in an enterprise setting (Admin Only)
router.use(adminProtect);

router.post('/single', uploadMiddleware.single('file'), uploadSingle);

router.post('/multiple', uploadMiddleware.array('files', 10), uploadMultiple);

router.post('/fields', 
  uploadMiddleware.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'gallery', maxCount: 5 }
  ]), 
  uploadFields
);

export default router;
