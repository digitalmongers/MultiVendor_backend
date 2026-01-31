import express from 'express';
import ReliabilityController from '../controllers/reliability.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import validate from '../middleware/validate.middleware.js';
import { saveReliabilitySchema } from '../validations/reliability.validation.js';
import cacheMiddleware from '../middleware/cache.middleware.js';

const router = express.Router();

// Public route
router.get('/public', cacheMiddleware(3600), ReliabilityController.getPublicReliabilities);

// Protected routes (Admin / Staff)
router.use(authorizeStaff(SYSTEM_PERMISSIONS.SYSTEM_SETTINGS));

router.route('/')
  .post(validate(saveReliabilitySchema), ReliabilityController.saveReliability)
  .get(ReliabilityController.getAllReliabilities);

router.patch('/:key/toggle-status', ReliabilityController.toggleStatus);

export default router;
