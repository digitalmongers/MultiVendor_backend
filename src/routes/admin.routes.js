import express from 'express';
import AdminController from '../controllers/admin.controller.js';
import { adminProtect } from '../middleware/adminAuth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { z } from 'zod';

import uploadMiddleware from '../middleware/upload.middleware.js';

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

router.post('/login', validate(loginSchema), AdminController.login);
router.post('/forgot-password', validate(forgotPasswordSchema), AdminController.forgotPassword);
router.post('/verify-otp', validate(verifyOtpSchema), AdminController.verifyOtp);
router.post('/reset-password', validate(resetPasswordSchema), AdminController.resetPassword);

// Protected routes
router.use(adminProtect);

router.post('/logout', AdminController.logout);
router.get('/me', AdminController.getMe);
router.patch('/profile', validate(updateProfileSchema), AdminController.updateProfile);
router.patch('/photo', uploadMiddleware.single('photo'), AdminController.updatePhoto);
router.delete('/photo', AdminController.deletePhoto);
router.patch('/update-password', validate(updatePasswordSchema), AdminController.updatePassword);

export default router;
