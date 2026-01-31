import express from 'express';
import GoogleMapController from '../controllers/googleMap.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import cacheMiddleware from '../middleware/cache.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { updateGoogleMapSchema } from '../validations/googleMap.validation.js';
import lockRequest from '../middleware/idempotency.middleware.js';
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests'
});

const router = express.Router();

router.get('/public', cacheMiddleware(3600), GoogleMapController.getPublicSettings);

router.use(authorizeStaff(SYSTEM_PERMISSIONS.THIRD_PARTY_SETUP));

router.get('/', GoogleMapController.getSettings);
router.patch('/', limiter, lockRequest(), validate(updateGoogleMapSchema), GoogleMapController.updateSettings);

export default router;
