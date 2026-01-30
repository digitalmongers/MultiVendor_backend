import express from 'express';
import AdminController from '../controllers/admin.controller.js';
import { adminProtect } from '../middleware/adminAuth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { HTTP_STATUS } from '../constants.js';
import { z } from 'zod';

import uploadMiddleware from '../middleware/upload.middleware.js';
import cacheMiddleware from '../middleware/cache.middleware.js';
import VendorValidation from '../validations/vendor.validation.js';

const router = express.Router();

// Validation schemas
const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    rememberMe: z.boolean().optional(),
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    phoneNumber: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number').optional(),
  }),
});

const updatePasswordSchema = z.object({
  body: z.object({
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirmation is required'),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }),
});

// Forgot Password Schemas
const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().length(6, 'OTP must be 6 digits'),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    resetToken: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirmation is required'),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }),
});

import rateLimit from 'express-rate-limit';

// Strict Rate Limiter for Auth Routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: HTTP_STATUS.TOO_MANY_REQUESTS,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
    code: 'AUTH_RATE_LIMIT'
  }
});

router.post('/login', authLimiter, validate(loginSchema), AdminController.login);
router.post('/refresh-token', AdminController.refreshToken); // New Route
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), AdminController.forgotPassword);
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), AdminController.verifyOtp);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), AdminController.resetPassword);

// Protected routes
router.use(adminProtect);

router.post('/logout', AdminController.logout);
router.get('/me', cacheMiddleware(3600), AdminController.getMe);
router.patch('/profile', validate(updateProfileSchema), AdminController.updateProfile);
router.patch('/photo', uploadMiddleware.single('photo'), AdminController.updatePhoto);
router.delete('/photo', AdminController.deletePhoto);
router.patch('/update-password', validate(updatePasswordSchema), AdminController.updatePassword);

// Vendor Management
router.get('/vendors/export', AdminController.exportVendors);
router.get('/vendors', AdminController.getAllVendors);
router.post('/vendors', validate(VendorValidation.adminCreateVendor), AdminController.createVendor);
router.get('/vendors/:vendorId', AdminController.getVendorById);
router.patch('/vendors/:vendorId/approve', AdminController.approveVendor);
router.patch('/vendors/:vendorId/reject', AdminController.rejectVendor);
router.patch('/vendors/:vendorId/suspend', AdminController.suspendVendor);
router.patch('/vendors/:vendorId/activate', AdminController.activateVendor);
router.delete('/vendors/:vendorId', AdminController.deleteVendor);

// Vendor Document Uploads (Admin)
router.patch('/vendors/:vendorId/documents/tin-certificate', uploadMiddleware.single('document'), AdminController.uploadVendorTinCertificate);
router.patch('/vendors/:vendorId/documents/gst-document', uploadMiddleware.single('document'), AdminController.uploadVendorGstDocument);
router.patch('/vendors/:vendorId/documents/pan-document', uploadMiddleware.single('document'), AdminController.uploadVendorPanDocument);
router.patch('/vendors/:vendorId/documents/address-proof', uploadMiddleware.single('document'), AdminController.uploadVendorAddressProof);

// Customer Management
router.get('/customers', AdminController.getAllCustomers);
router.patch('/customers/:customerId/toggle-status', AdminController.toggleCustomerStatus);

export default router;
