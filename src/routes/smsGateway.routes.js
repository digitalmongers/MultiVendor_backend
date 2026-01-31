import express from 'express';
import SmsGatewayController from '../controllers/smsGateway.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import validate from '../middleware/validate.middleware.js';
import { updateSmsGatewaySchema } from '../validations/smsGateway.validation.js';
import lockRequest from '../middleware/idempotency.middleware.js';
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many requests'
});

const router = express.Router();

router.use(authorizeStaff(SYSTEM_PERMISSIONS.THIRD_PARTY_SETUP));

router.get('/', SmsGatewayController.getAllGateways);
router.patch('/:name', limiter, lockRequest(), validate(updateSmsGatewaySchema), SmsGatewayController.updateGateway);

export default router;
