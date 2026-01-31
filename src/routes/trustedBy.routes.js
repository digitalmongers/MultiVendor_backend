import express from 'express';
import TrustedByController from '../controllers/trustedBy.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import validate from '../middleware/validate.middleware.js';
import cacheMiddleware from '../middleware/cache.middleware.js';
import { createTrustedBySchema, updateTrustedBySchema } from '../validations/trustedBy.validation.js';

const router = express.Router();

// Public route with caching (1 hour)
router.get('/public', cacheMiddleware(3600), TrustedByController.getPublicLogos);

// Protected routes (Admin / Staff)
router.use(authorizeStaff(SYSTEM_PERMISSIONS.SYSTEM_SETTINGS));

router.route('/')
  .post(validate(createTrustedBySchema), TrustedByController.createLogo)
  .get(TrustedByController.getAllLogos);

router.route('/:id')
  .get(TrustedByController.getLogoById)
  .patch(validate(updateTrustedBySchema), TrustedByController.updateLogo)
  .delete(TrustedByController.deleteLogo);

router.patch('/:id/toggle-status', TrustedByController.toggleStatus);

export default router;
