import express from 'express';
import rateLimit from 'express-rate-limit';
import validate from '../middleware/validate.middleware.js';
import VendorValidation from '../validations/vendor.validation.js';
import VendorController, { uploadTinCertificate, uploadGstDocument, uploadPanDocument, uploadAddressProof } from '../controllers/vendor.controller.js';
import uploadMiddleware from '../middleware/upload.middleware.js';
import { protectVendor } from '../middleware/vendorAuth.middleware.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many requests, please try again later',
});

router.post(
  '/signup-step-1',
  authLimiter,
  validate(VendorValidation.signupStep1),
  VendorController.signupStep1
);

router.post(
  '/signup-step-2/:vendorId',
  authLimiter,
  validate(VendorValidation.signupStep2),
  VendorController.signupStep2
);

router.post(
  '/login',
  authLimiter,
  validate(VendorValidation.login),
  VendorController.login
);

router.post(
  '/refresh-token',
  VendorController.refreshToken
);

router.get(
  '/me',
  protectVendor,
  VendorController.getMe
);

router.patch(
  '/profile',
  protectVendor,
  validate(VendorValidation.updateProfile),
  VendorController.updateProfile
);

router.patch(
  '/bank-details',
  protectVendor,
  validate(VendorValidation.updateBankDetails),
  VendorController.updateBankDetails
);

// Document Uploads (Protected)
router.patch('/documents/tin-certificate', protectVendor, uploadMiddleware.single('document'), catchAsync(VendorController.uploadTinCertificate));
router.patch('/documents/gst-document', protectVendor, uploadMiddleware.single('document'), catchAsync(VendorController.uploadGstDocument));
router.patch('/documents/pan-document', protectVendor, uploadMiddleware.single('document'), catchAsync(VendorController.uploadPanDocument));
router.patch('/documents/address-proof', protectVendor, uploadMiddleware.single('document'), catchAsync(VendorController.uploadAddressProof));

router.patch(
  '/photo',
  protectVendor,
  uploadMiddleware.single('photo'),
  VendorController.updatePhoto
);

router.patch(
  '/business-logo',
  protectVendor,
  uploadMiddleware.single('logo'),
  VendorController.updateBusinessLogo
);

router.patch(
  '/business-banner',
  protectVendor,
  uploadMiddleware.single('banner'),
  VendorController.updateBusinessBanner
);

router.patch(
  '/update-password',
  protectVendor,
  validate(VendorValidation.updatePassword),
  VendorController.updatePassword
);

router.post(
  '/logout',
  protectVendor,
  VendorController.logout
);

export default router;
