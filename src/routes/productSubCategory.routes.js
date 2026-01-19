import express from 'express';
import ProductSubCategoryController from '../controllers/productSubCategory.controller.js';
import { adminProtect } from '../middleware/adminAuth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import cacheMiddleware from '../middleware/cache.middleware.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const subCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Subcategory name is required'),
    category: z.string().min(24, 'Valid Category ID is required'),
  }),
});

/**
 * Public Routes
 */
router.get('/', cacheMiddleware(3600), ProductSubCategoryController.getAllSubCategories);
router.get('/category/:categoryId', cacheMiddleware(3600), ProductSubCategoryController.getSubCategoriesByCategory);

/**
 * Admin Protected Routes
 */
router.use(adminProtect);

router.get('/admin', ProductSubCategoryController.getAllSubCategories); // Un-cached for Admin

router.post('/', validate(subCategorySchema), ProductSubCategoryController.createSubCategory);
router.patch('/:id', validate(z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    category: z.string().min(24).optional(),
  }),
})), ProductSubCategoryController.updateSubCategory);
router.delete('/:id', ProductSubCategoryController.deleteSubCategory);

export default router;
