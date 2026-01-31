import express from 'express';
import ContentController from '../controllers/content.controller.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import validate from '../middleware/validate.middleware.js';
import { z } from 'zod';
import cacheMiddleware from '../middleware/cache.middleware.js';
import lockRequest from '../middleware/idempotency.middleware.js';

const router = express.Router();

// Validation schemas
const contentSchema = (field) => z.object({
  body: z.object({
    [field]: z.string().min(1, `${field} content cannot be empty`),
  }),
});

/**
 * Public Routes
 */
// Single endpoint to get all business page content
router.get('/', cacheMiddleware(3600), ContentController.getContent);
// Individual public routes
router.get('/about-us', cacheMiddleware(3600), ContentController.getAboutUs); 
router.get('/terms-and-conditions', cacheMiddleware(3600), ContentController.getTermsAndConditions);
router.get('/privacy-policy', cacheMiddleware(3600), ContentController.getPrivacyPolicy);
router.get('/refund-policy', cacheMiddleware(3600), ContentController.getRefundPolicy);
router.get('/return-policy', cacheMiddleware(3600), ContentController.getReturnPolicy);
router.get('/shipping-policy', cacheMiddleware(3600), ContentController.getShippingPolicy);
router.get('/cancellation-policy', cacheMiddleware(3600), ContentController.getCancellationPolicy);

/**
 * Admin / Staff Protected Routes
 */
router.use(authorizeStaff(SYSTEM_PERMISSIONS.SYSTEM_SETTINGS));

router.patch('/about-us', lockRequest('update_about_us'), validate(contentSchema('aboutUs')), ContentController.updateAboutUs);
router.patch('/terms-and-conditions', lockRequest('update_terms'), validate(contentSchema('termsAndConditions')), ContentController.updateTermsAndConditions);
router.patch('/privacy-policy', lockRequest('update_privacy'), validate(contentSchema('privacyPolicy')), ContentController.updatePrivacyPolicy);
router.patch('/refund-policy', lockRequest('update_refund'), validate(contentSchema('refundPolicy')), ContentController.updateRefundPolicy);
router.patch('/return-policy', lockRequest('update_return'), validate(contentSchema('returnPolicy')), ContentController.updateReturnPolicy);
router.patch('/shipping-policy', lockRequest('update_shipping'), validate(contentSchema('shippingPolicy')), ContentController.updateShippingPolicy);
router.patch('/cancellation-policy', lockRequest('update_cancellation'), validate(contentSchema('cancellationPolicy')), ContentController.updateCancellationPolicy);

export default router;
