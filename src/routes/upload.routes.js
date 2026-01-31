import express from 'express';
import uploadMiddleware from '../middleware/upload.middleware.js';
import { uploadSingle, uploadMultiple, uploadFields } from '../controllers/upload.controller.js';
import { protectAll } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: File upload management
 */

// All upload routes are protected but available to any authenticated user
router.use(protectAll);

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
