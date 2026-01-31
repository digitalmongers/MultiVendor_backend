import express from 'express';
import PaymentGatewayController from '../controllers/paymentGateway.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import cacheMiddleware from '../middleware/cache.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { updateGatewaySchema } from '../validations/paymentGateway.validation.js';
import rateLimit from 'express-rate-limit';

const gatewayLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});

const router = express.Router();

/**
 * PUBLIC ROUTES
 */
router.get('/public', cacheMiddleware(3600), PaymentGatewayController.getPublicGateways);

/**
 * ADMIN / STAFF ROUTES
 */
router.use(authorizeStaff(SYSTEM_PERMISSIONS.THIRD_PARTY_SETUP));

router.get('/', PaymentGatewayController.getAllGateways);
router.patch('/:name', gatewayLimiter, validate(updateGatewaySchema), PaymentGatewayController.updateGateway);

export default router;
