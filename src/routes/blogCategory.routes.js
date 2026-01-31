import express from 'express';
import validate from '../middleware/validate.middleware.js';
import BlogCategoryController from '../controllers/blogCategory.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(50),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});

const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(50).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});

// Admin / Staff protected routes
router.use(authorizeStaff(SYSTEM_PERMISSIONS.BLOG_MANAGEMENT));

router.post('/', validate(createCategorySchema), BlogCategoryController.createCategory);
router.get('/', BlogCategoryController.getAllCategories);
router.get('/:id', BlogCategoryController.getCategoryById);
router.patch('/:id', validate(updateCategorySchema), BlogCategoryController.updateCategory);
router.delete('/:id', BlogCategoryController.deleteCategory);
router.patch('/:id/toggle-status', BlogCategoryController.toggleStatus);

export default router;
