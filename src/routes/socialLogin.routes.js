import express from 'express';
import SocialLoginController from '../controllers/socialLogin.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import cacheMiddleware from '../middleware/cache.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { updateSocialLoginSchema } from '../validations/socialLogin.validation.js';
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests'
});

const router = express.Router();

router.get('/public', cacheMiddleware(3600), SocialLoginController.getPublicProviders);

router.use(authorizeStaff(SYSTEM_PERMISSIONS.THIRD_PARTY_SETUP));

router.get('/', SocialLoginController.getAllProviders);
router.patch('/:provider', limiter, validate(updateSocialLoginSchema), SocialLoginController.updateProvider);

export default router;
