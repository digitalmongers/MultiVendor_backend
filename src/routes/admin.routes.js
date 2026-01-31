import express from 'express';
import AdminController from '../controllers/admin.controller.js';
import { adminProtect } from '../middleware/adminAuth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { HTTP_STATUS } from '../constants.js';
import { z } from 'zod';

import uploadMiddleware from '../middleware/upload.middleware.js';
import cacheMiddleware from '../middleware/cache.middleware.js';
import VendorValidation from '../validations/vendor.validation.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import lockRequest from '../middleware/idempotency.middleware.js';

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

// Super Admin Only Profile Routes
router.use('/logout', adminProtect);
router.post('/logout', AdminController.logout);

router.use('/me', adminProtect);
router.get('/me', cacheMiddleware(3600), AdminController.getMe);

router.use('/profile', adminProtect);
router.patch('/profile', lockRequest('admin_update_profile'), validate(updateProfileSchema), AdminController.updateProfile);

router.use('/photo', adminProtect);
router.patch('/photo', lockRequest('admin_update_photo'), uploadMiddleware.single('photo'), AdminController.updatePhoto);
router.delete('/photo', lockRequest('admin_delete_photo'), AdminController.deletePhoto);

router.use('/update-password', adminProtect);
router.patch('/update-password', lockRequest('admin_update_password'), validate(updatePasswordSchema), AdminController.updatePassword);

// Vendor Management
router.get('/vendors/export', authorizeStaff(SYSTEM_PERMISSIONS.VENDOR_MANAGEMENT), AdminController.exportVendors);
router.get('/vendors', authorizeStaff(SYSTEM_PERMISSIONS.VENDOR_MANAGEMENT), AdminController.getAllVendors);
router.post('/vendors', authorizeStaff(SYSTEM_PERMISSIONS.VENDOR_MANAGEMENT), lockRequest('admin_create_vendor'), validate(VendorValidation.adminCreateVendor), AdminController.createVendor);
router.get('/vendors/:vendorId', authorizeStaff(SYSTEM_PERMISSIONS.VENDOR_MANAGEMENT), AdminController.getVendorById);
router.patch('/vendors/:vendorId/approve', authorizeStaff(SYSTEM_PERMISSIONS.VENDOR_MANAGEMENT), lockRequest('admin_approve_vendor'), AdminController.approveVendor);
router.patch('/vendors/:vendorId/reject', authorizeStaff(SYSTEM_PERMISSIONS.VENDOR_MANAGEMENT), lockRequest('admin_reject_vendor'), AdminController.rejectVendor);
router.patch('/vendors/:vendorId/suspend', authorizeStaff(SYSTEM_PERMISSIONS.VENDOR_MANAGEMENT), lockRequest('admin_suspend_vendor'), AdminController.suspendVendor);
router.patch('/vendors/:vendorId/activate', authorizeStaff(SYSTEM_PERMISSIONS.VENDOR_MANAGEMENT), lockRequest('admin_activate_vendor'), AdminController.activateVendor);
router.delete('/vendors/:vendorId', authorizeStaff(SYSTEM_PERMISSIONS.VENDOR_MANAGEMENT), lockRequest('admin_delete_vendor'), AdminController.deleteVendor);

// Vendor Document Uploads (Admin/Staff)
router.patch('/vendors/:vendorId/documents/tin-certificate', authorizeStaff(SYSTEM_PERMISSIONS.VENDOR_MANAGEMENT), lockRequest('admin_upload_tin'), uploadMiddleware.single('document'), AdminController.uploadVendorTinCertificate);
router.patch('/vendors/:vendorId/documents/gst-document', authorizeStaff(SYSTEM_PERMISSIONS.VENDOR_MANAGEMENT), lockRequest('admin_upload_gst'), uploadMiddleware.single('document'), AdminController.uploadVendorGstDocument);
router.patch('/vendors/:vendorId/documents/pan-document', authorizeStaff(SYSTEM_PERMISSIONS.VENDOR_MANAGEMENT), lockRequest('admin_upload_pan'), uploadMiddleware.single('document'), AdminController.uploadVendorPanDocument);
router.patch('/vendors/:vendorId/documents/address-proof', authorizeStaff(SYSTEM_PERMISSIONS.VENDOR_MANAGEMENT), lockRequest('admin_upload_address'), uploadMiddleware.single('document'), AdminController.uploadVendorAddressProof);

// Customer Management
router.get('/customers', authorizeStaff(SYSTEM_PERMISSIONS.USER_MANAGEMENT), AdminController.getAllCustomers);
router.patch('/customers/:customerId/toggle-status', authorizeStaff(SYSTEM_PERMISSIONS.USER_MANAGEMENT), AdminController.toggleCustomerStatus);

export default router;
