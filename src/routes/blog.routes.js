import express from 'express';
import validate from '../middleware/validate.middleware.js';
import BlogController from '../controllers/blog.controller.js';
import uploadMiddleware from '../middleware/upload.middleware.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const createBlogSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title is too short').max(200),
    description: z.string().min(10, 'Description is too short'),
    category: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID'),
    writerName: z.string().min(2, 'Writer name is too short'),
    publishDate: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    status: z.enum(['active', 'inactive', 'draft']).optional(),
  }),
});

const updateBlogSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(10).optional(),
    category: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    writerName: z.string().min(2).optional(),
    publishDate: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    status: z.enum(['active', 'inactive', 'draft']).optional(),
  }),
});

const blogSettingSchema = z.object({
  body: z.object({
    isBlogEnabled: z.boolean().optional(),
    introspectionTitle: z.string().min(1).max(100).optional(),
    introspectionSubtitle: z.string().max(500).optional(),
  }),
});

// Admin / Staff protected routes
router.use(authorizeStaff(SYSTEM_PERMISSIONS.BLOG_MANAGEMENT));

router.get('/settings', BlogController.getSettings);
router.patch('/settings', validate(blogSettingSchema), BlogController.updateSettings);

router.post(
  '/',
  uploadMiddleware.fields([
    { name: 'blogImage', maxCount: 1 },
    { name: 'metaImage', maxCount: 1 },
  ]),
  validate(createBlogSchema),
  BlogController.createBlog
);

router.get('/', BlogController.getAllBlogs);
router.get('/:id', BlogController.getBlogById);

router.patch(
  '/:id',
  uploadMiddleware.fields([
    { name: 'blogImage', maxCount: 1 },
    { name: 'metaImage', maxCount: 1 },
  ]),
  validate(updateBlogSchema),
  BlogController.updateBlog
);

router.delete('/:id', BlogController.deleteBlog);
router.patch('/:id/toggle-status', BlogController.toggleStatus);

export default router;
