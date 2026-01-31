import express from 'express';
import SystemSettingController from '../controllers/systemSetting.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import validate from '../middleware/validate.middleware.js';
import { updateSystemSettingSchema } from '../validations/systemSetting.validation.js';
import lockRequest from '../middleware/idempotency.middleware.js';
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Strict limit for system settings
  message: 'Too many setting update requests'
});

const router = express.Router();

// Require specific system permission (SYSTEM_SETTINGS)
router.use(authorizeStaff(SYSTEM_PERMISSIONS.SYSTEM_SETTINGS));

router.get('/', SystemSettingController.getSettings);

router.patch(
  '/', 
  limiter, 
  lockRequest(), // Idempotency
  validate(updateSystemSettingSchema), 
  SystemSettingController.updateSettings
);

export default router;
