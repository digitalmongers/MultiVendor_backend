import express from 'express';
import rateLimit from 'express-rate-limit';
import validate from '../middleware/validate.middleware.js';
import CustomerValidation from '../validations/customer.validation.js';
import CustomerController from '../controllers/customer.controller.js';
import { protectCustomer } from '../middleware/customerAuth.middleware.js';

import lockRequest from '../middleware/idempotency.middleware.js';

const router = express.Router();

// Rate limiting for auth/otp endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @desc    Customer Logout
 * @route   POST /api/v1/customers/logout
 * @access  Private
 */
router.post(
  '/logout',
  protectCustomer,
  CustomerController.logout
);

/**
 * @desc    Get Current Customer Profile
 * @route   GET /api/v1/customers/me
 * @access  Private
 */
router.get(
  '/me',
  protectCustomer,
  CustomerController.getMe
);

/**
 * @desc    Update Customer Profile
 * @route   PATCH /api/v1/customers/profile
 * @access  Private
 */
router.patch(
  '/profile',
  protectCustomer,
  lockRequest(),
  validate(CustomerValidation.updateProfile),
  CustomerController.updateProfile
);

router.post(
  '/signup',
  authLimiter,
  lockRequest(),
  validate(CustomerValidation.signup),
  CustomerController.signup
);

router.post(
  '/verify-otp',
  authLimiter,
  lockRequest(),
  validate(CustomerValidation.verifyOtp),
  CustomerController.verifyOtp
);

router.post(
  '/resend-otp',
  authLimiter,
  lockRequest(),
  validate(CustomerValidation.resendOtp),
  CustomerController.resendOtp
);

router.post(
  '/login',
  authLimiter,
  lockRequest(),
  validate(CustomerValidation.login),
  CustomerController.login
);

router.post(
  '/forgot-password',
  authLimiter,
  lockRequest(),
  validate(CustomerValidation.forgotPassword),
  CustomerController.forgotPassword
);

router.post(
  '/verify-reset-otp',
  authLimiter,
  lockRequest(),
  validate(CustomerValidation.verifyResetOtp),
  CustomerController.verifyResetOtp
);

router.post(
  '/reset-password',
  authLimiter,
  lockRequest(),
  validate(CustomerValidation.resetPassword),
  CustomerController.resetPassword
);

export default router;
