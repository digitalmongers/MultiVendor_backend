import express from 'express';
import PaymentSettingController from '../controllers/paymentSetting.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import cacheMiddleware from '../middleware/cache.middleware.js';
import lockRequest from '../middleware/idempotency.middleware.js';

const router = express.Router();

/**
 * PUBLIC ROUTES
 */
router.get('/', cacheMiddleware(3600), PaymentSettingController.getSettings);

/**
 * ADMIN ROUTES
 */
router.patch(
  '/', 
  authorizeStaff(SYSTEM_PERMISSIONS.SYSTEM_SETTINGS), 
  lockRequest(),
  PaymentSettingController.updateSettings
);

export default router;
