import express from 'express';
import SliderController from '../controllers/slider.controller.js';
import { adminProtect } from '../middleware/adminAuth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { createSliderSchema, updateSliderSchema } from '../validations/slider.validation.js';
import cacheMiddleware from '../middleware/cache.middleware.js';

const router = express.Router();

// Public routes
router.get('/public', cacheMiddleware(3600), SliderController.getPublicSliders);

// Protected routes
router.use(adminProtect); 

router.route('/')
  .post(validate(createSliderSchema), SliderController.createSlider)
  .get(SliderController.getAllSliders);

router.route('/:id')
  .get(SliderController.getSliderById)
  .patch(validate(updateSliderSchema), SliderController.updateSlider)
  .delete(SliderController.deleteSlider);

router.patch('/:id/toggle-status', SliderController.toggleStatus);

export default router;
