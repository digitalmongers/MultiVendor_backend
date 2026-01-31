import express from 'express';
import FAQController from '../controllers/faq.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import validate from '../middleware/validate.middleware.js';
import uploadMiddleware from '../middleware/upload.middleware.js';
import { z } from 'zod';
import cacheMiddleware from '../middleware/cache.middleware.js';

const router = express.Router();

// Validation schemas
const faqSchema = z.object({
  body: z.object({
    question: z.string().min(1, 'Question is required'),
    answer: z.string().min(1, 'Answer is required'),
  }),
});

const updateFaqSchema = z.object({
  body: z.object({
    question: z.string().min(1).optional(),
    answer: z.string().min(1).optional(),
  }),
});

/**
 * Public Routes
 */
router.get('/', cacheMiddleware(3600), FAQController.getAllFAQs);

/**
 * Admin / Staff Protected Routes
 */
router.use(authorizeStaff(SYSTEM_PERMISSIONS.SYSTEM_SETTINGS));

router.post('/', validate(faqSchema), FAQController.createFAQ);
router.get('/admin', FAQController.getAllFAQs);
router.get('/:id', FAQController.getFAQById);
router.patch('/:id', validate(updateFaqSchema), FAQController.updateFAQ);
router.delete('/:id', FAQController.deleteFAQ);

export default router;
