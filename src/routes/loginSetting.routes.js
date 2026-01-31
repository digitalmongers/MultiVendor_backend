import express from 'express';
import LoginSettingController from '../controllers/loginSetting.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import validate from '../middleware/validate.middleware.js';
import { updateLoginSettingSchema } from '../validations/loginSetting.validation.js';
import rateLimit from 'express-rate-limit';

import lockRequest from '../middleware/idempotency.middleware.js';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many requests'
});

const router = express.Router();

router.use(authorizeStaff(SYSTEM_PERMISSIONS.SYSTEM_SETTINGS));

router.get('/', LoginSettingController.getSettings);
router.patch('/', limiter, lockRequest(), validate(updateLoginSettingSchema), LoginSettingController.updateSettings);

export default router;
