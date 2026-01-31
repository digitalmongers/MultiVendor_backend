import express from 'express';
import CookieConsentController from '../controllers/cookieConsent.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import validate from '../middleware/validate.middleware.js';
import { z } from 'zod';
import cacheMiddleware from '../middleware/cache.middleware.js';
import lockRequest from '../middleware/idempotency.middleware.js';

const router = express.Router();

/**
 * Validation Schema
 */
const updateSchema = z.object({
  body: z.object({
    isActive: z.boolean().optional(),
    content: z.string().trim().optional(),
  }).refine((data) => {
    if (data.isActive === true && (!data.content || data.content.length === 0)) {
      return false;
    }
    return true;
  }, {
    message: "Content is required when activating cookie consent",
    path: ["content"]
  })
});

/**
 * Routes
 */

// Public Route (with caching)
router.get('/', cacheMiddleware(3600), CookieConsentController.getSettings);

// Protected Route (Admin/Staff)
router.patch(
  '/',
  authorizeStaff(SYSTEM_PERMISSIONS.SYSTEM_SETTINGS),
  lockRequest('update_cookie_consent'),
  validate(updateSchema),
  CookieConsentController.updateSettings
);

export default router;
