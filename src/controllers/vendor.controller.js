import VendorService from '../services/vendor.service.js';
import ApiResponse from '../utils/apiResponse.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import Logger from '../utils/logger.js';

/**
 * @desc    Vendor Signup Step 1
 * @route   POST /api/v1/vendors/signup-step-1
 * @access  Public
 */
export const signupStep1 = async (req, res) => {
  Logger.info(`Vendor Step 1 signup request for: ${req.body.email}`);
  const result = await VendorService.signupStep1(req.body);
  
  res.status(HTTP_STATUS.CREATED).json(
    new ApiResponse(HTTP_STATUS.CREATED, result, 'Step 1 complete.')
  );
};

/**
 * @desc    Vendor Signup Step 2
 * @route   POST /api/v1/vendors/signup-step-2/:vendorId
 * @access  Public
 */
export const signupStep2 = async (req, res) => {
  const { vendorId } = req.params;
  Logger.info(`Vendor Step 2 signup request for vendor ID: ${vendorId}`);
  const result = await VendorService.signupStep2(vendorId, req.body);
  
  res.status(HTTP_STATUS.CREATED).json(
    new ApiResponse(HTTP_STATUS.CREATED, result, result.message)
  );
};

/**
 * @desc    Vendor Login
 * @route   POST /api/v1/vendors/login
 * @access  Public
 */
export const login = async (req, res) => {
  Logger.info(`Vendor login attempt: ${req.body.email}`);
  const { email, password } = req.body;
  const { vendor, accessToken, refreshToken } = await VendorService.login(email, password);

  const accessCookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  const refreshCookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res.status(HTTP_STATUS.OK)
    .cookie('vendorToken', accessToken, accessCookieOptions)
    .cookie('vendorRefreshToken', refreshToken, refreshCookieOptions)
    .json(new ApiResponse(HTTP_STATUS.OK, { vendor, token: accessToken }, SUCCESS_MESSAGES.LOGIN_SUCCESS));
};

/**
 * @desc    Refresh Vendor Access Token
 * @route   POST /api/v1/vendors/refresh-token
 * @access  Public (Cookie/Body)
 */
export const refreshToken = async (req, res) => {
  const token = req.cookies?.vendorRefreshToken || req.body.refreshToken;
  const { accessToken } = await VendorService.refreshToken(token);

  const accessCookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res.cookie('vendorToken', accessToken, accessCookieOptions)
    .status(HTTP_STATUS.OK)
    .json(new ApiResponse(HTTP_STATUS.OK, { token: accessToken }, 'Token Refreshed'));
};

/**
 * @desc    Get Current Vendor Profile
 * @route   GET /api/v1/vendors/me
 * @access  Private (Vendor)
 */
export const getMe = async (req, res) => {
  const vendorProfile = {
    id: req.vendor._id,
    email: req.vendor.email,
    phoneNumber: req.vendor.phoneNumber,
    
    // Personal Information
    firstName: req.vendor.firstName,
    lastName: req.vendor.lastName,
    photo: req.vendor.photo,
    
    // Business Information
    businessName: req.vendor.businessName,
    businessAddress: req.vendor.businessAddress,
    businessLogo: req.vendor.businessLogo,
    businessBanner: req.vendor.businessBanner,
    
    // Business TIN (Optional)
    businessTin: req.vendor.businessTin,
    
    // Tax & Legal (Optional)
    taxAndLegal: req.vendor.taxAndLegal,
    
    // Bank Details
    bankDetails: req.vendor.bankDetails,
    
    // Metadata
    status: req.vendor.status,
    role: req.vendor.role,
    registrationStep: req.vendor.registrationStep,
    isEmailVerified: req.vendor.isEmailVerified,
    
    // Timestamps
    registeredAt: req.vendor.createdAt,
    lastLogin: req.vendor.lastLogin,
    updatedAt: req.vendor.updatedAt,
  };

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, vendorProfile, SUCCESS_MESSAGES.OPERATION_SUCCESS)
  );
};

/**
 * @desc    Update Vendor Profile
 * @route   PATCH /api/v1/vendors/profile
 * @access  Private (Vendor)
 */
export const updateProfile = async (req, res) => {
  const result = await VendorService.updateProfile(req.vendor._id, req.body);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
};

/**
 * @desc    Update Vendor Bank Details
 * @route   PATCH /api/v1/vendors/bank-details
 * @access  Private (Vendor)
 */
export const updateBankDetails = async (req, res) => {
  const result = await VendorService.updateBankDetails(req.vendor._id, req.body);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
};

/**
 * @desc    Upload TIN Certificate
 * @route   PATCH /api/v1/vendors/documents/tin-certificate
 * @access  Private (Vendor)
 */
export const uploadTinCertificate = async (req, res) => {
  if (!req.file) {
    throw new AppError('Please upload a file', HTTP_STATUS.BAD_REQUEST);
  }
  const result = await VendorService.uploadDocument(req.vendor._id, req.file, 'tinCertificate');
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
};

/**
 * @desc    Upload GST Document
 * @route   PATCH /api/v1/vendors/documents/gst-document
 * @access  Private (Vendor)
 */
export const uploadGstDocument = async (req, res) => {
  if (!req.file) {
    throw new AppError('Please upload a file', HTTP_STATUS.BAD_REQUEST);
  }
  const result = await VendorService.uploadDocument(req.vendor._id, req.file, 'gstDocument');
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
};

/**
 * @desc    Upload PAN Document
 * @route   PATCH /api/v1/vendors/documents/pan-document
 * @access  Private (Vendor)
 */
export const uploadPanDocument = async (req, res) => {
  if (!req.file) {
    throw new AppError('Please upload a file', HTTP_STATUS.BAD_REQUEST);
  }
  const result = await VendorService.uploadDocument(req.vendor._id, req.file, 'panDocument');
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
};

/**
 * @desc    Upload Address Proof
 * @route   PATCH /api/v1/vendors/documents/address-proof
 * @access  Private (Vendor)
 */
export const uploadAddressProof = async (req, res) => {
  if (!req.file) {
    throw new AppError('Please upload a file', HTTP_STATUS.BAD_REQUEST);
  }
  const result = await VendorService.uploadDocument(req.vendor._id, req.file, 'addressProof');
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
};

/**
 * @desc    Update Vendor Photo
 * @route   PATCH /api/v1/vendors/photo
 * @access  Private (Vendor)
 */
export const updatePhoto = async (req, res) => {
  if (!req.file) {
    throw new AppError('Photo is required', HTTP_STATUS.BAD_REQUEST);
  }
  const photo = await VendorService.updateImage(req.vendor._id, req.file, 'photo');
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, photo, 'Photo updated successfully'));
};

/**
 * @desc    Update Vendor Business Logo
 * @route   PATCH /api/v1/vendors/business-logo
 * @access  Private (Vendor)
 */
export const updateBusinessLogo = async (req, res) => {
  if (!req.file) {
    throw new AppError('Logo is required', HTTP_STATUS.BAD_REQUEST);
  }
  const logo = await VendorService.updateImage(req.vendor._id, req.file, 'businessLogo');
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, logo, 'Business logo updated successfully'));
};

/**
 * @desc    Update Vendor Business Banner
 * @route   PATCH /api/v1/vendors/business-banner
 * @access  Private (Vendor)
 */
export const updateBusinessBanner = async (req, res) => {
  if (!req.file) {
    throw new AppError('Banner is required', HTTP_STATUS.BAD_REQUEST);
  }
  const banner = await VendorService.updateImage(req.vendor._id, req.file, 'businessBanner');
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, banner, 'Business banner updated successfully'));
};

/**
 * @desc    Vendor Logout
 * @route   POST /api/v1/vendors/logout
 * @access  Private (Vendor)
 */
export const logout = async (req, res) => {
  const vendorId = req.vendor?._id;

  if (vendorId) {
    await VendorService.invalidateAllSessions(vendorId);
  }

  const cookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 10 * 1000), // Expire in 10 seconds
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res.cookie('vendorToken', 'none', cookieOptions);
  res.cookie('vendorRefreshToken', 'none', cookieOptions);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, {}, SUCCESS_MESSAGES.LOGOUT_SUCCESS));
};

/**
 * @desc    Update Vendor Password
 * @route   PATCH /api/v1/vendors/update-password
 * @access  Private (Vendor)
 */
export const updatePassword = async (req, res) => {
  const { newPassword } = req.body;
  const result = await VendorService.updatePassword(req.vendor._id, newPassword);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, result.message));
};

export default {
  signupStep1,
  signupStep2,
  login,
  getMe,
  logout,
  refreshToken,
  updateProfile,
  updatePhoto,
  updateBusinessLogo,
  updateBusinessBanner,
  updateBankDetails,
  updatePassword,
};
