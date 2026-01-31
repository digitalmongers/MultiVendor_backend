import express from 'express';
import SocialMediaController from '../controllers/socialMedia.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import validate from '../middleware/validate.middleware.js';
import { saveSocialMediaSchema, updateSocialMediaSchema } from '../validations/socialMedia.validation.js';
import cacheMiddleware from '../middleware/cache.middleware.js';

const router = express.Router();

// Public route
router.get('/public', cacheMiddleware(3600), SocialMediaController.getPublicLinks);

// Protected routes (Admin / Staff)
router.use(authorizeStaff(SYSTEM_PERMISSIONS.SYSTEM_SETTINGS));

router.route('/')
  .post(validate(saveSocialMediaSchema), SocialMediaController.saveLink)
  .get(SocialMediaController.getAllLinks);

router.route('/:id')
  .patch(validate(updateSocialMediaSchema), SocialMediaController.updateLink)
  .delete(SocialMediaController.deleteLink);

router.patch('/:id/toggle-status', SocialMediaController.toggleStatus);

export default router;
