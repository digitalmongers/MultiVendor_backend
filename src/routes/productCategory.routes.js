import express from 'express';
import ProductCategoryController from '../controllers/productCategory.controller.js';
import { adminProtect } from '../middleware/adminAuth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import uploadMiddleware from '../middleware/upload.middleware.js';
import cacheMiddleware from '../middleware/cache.middleware.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Category name is required'),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});

const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});

/**
 * Public Routes
 */
router.get('/', cacheMiddleware(3600), ProductCategoryController.getAllCategories);

/**
 * Admin Protected Routes
 */
router.use(adminProtect);

router.get('/admin', ProductCategoryController.getAllCategories); // Un-cached for Admin

router.post('/', uploadMiddleware.single('logo'), validate(createCategorySchema), ProductCategoryController.createCategory);
router.patch('/:id', uploadMiddleware.single('logo'), validate(updateCategorySchema), ProductCategoryController.updateCategory);
router.delete('/:id', ProductCategoryController.deleteCategory);
router.patch('/:id/toggle-status', validate(z.object({
  body: z.object({ status: z.enum(['active', 'inactive']) })
})), ProductCategoryController.toggleStatus);

export default router;
