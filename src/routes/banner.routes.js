import express from 'express';
import BannerController from '../controllers/banner.controller.js';
import { adminProtect } from '../middleware/adminAuth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { createBannerSchema, updateBannerSchema } from '../validations/banner.validation.js';
import cacheMiddleware from '../middleware/cache.middleware.js';

const router = express.Router();

// Public routes
router.get('/public', cacheMiddleware(3600), BannerController.getPublicBanners);

// Protected routes (Admin only)
router.use(adminProtect);

router.route('/')
  .post(validate(createBannerSchema), BannerController.createBanner)
  .get(BannerController.getAllBanners);

router.route('/:id')
  .get(BannerController.getBannerById)
  .patch(validate(updateBannerSchema), BannerController.updateBanner)
  .delete(BannerController.deleteBanner);

router.patch('/:id/toggle-status', BannerController.toggleStatus);

export default router;
