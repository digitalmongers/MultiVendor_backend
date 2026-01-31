import express from 'express';
import SocialMediaChatController from '../controllers/socialMediaChat.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import cacheMiddleware from '../middleware/cache.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { updateSocialMediaChatSchema } from '../validations/socialMediaChat.validation.js';
import lockRequest from '../middleware/idempotency.middleware.js';

const router = express.Router();

router.get('/public', cacheMiddleware(3600), SocialMediaChatController.getPublicPlatforms);

router.use(authorizeStaff(SYSTEM_PERMISSIONS.THIRD_PARTY_SETUP));

router.get('/', SocialMediaChatController.getAllPlatforms);
router.patch('/:platform', lockRequest(), validate(updateSocialMediaChatSchema), SocialMediaChatController.updatePlatform);

export default router;
