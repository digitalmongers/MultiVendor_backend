import express from 'express';
import NewsletterController from '../controllers/newsletter.controller.js';
import { adminProtect } from '../middleware/adminAuth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { z } from 'zod';

import cacheMiddleware from '../middleware/cache.middleware.js';

const router = express.Router();

// Validation schema
const subscribeSchema = z.object({
  body: z.object({
    email: z.string().email('Please provide a valid email address'),
  }),
});

/**
 * Public Routes
 */
router.post('/subscribe', validate(subscribeSchema), NewsletterController.subscribe);

/**
 * Admin Protected Routes
 */
router.use(adminProtect);
router.get('/admin/subscribers', cacheMiddleware(300), NewsletterController.getSubscribers);

export default router;
