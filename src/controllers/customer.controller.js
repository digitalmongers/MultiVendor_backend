import SystemSettingRepository from '../repositories/systemSetting.repository.js';
import CustomerService from '../services/customer.service.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import AuditLogger from '../utils/audit.js';
import Logger from '../utils/logger.js';

// ... (previous imports)

/**
 * @desc    Customer Login
 * @route   POST /api/v1/customers/login
 * @access  Public
 */
export const login = async (req, res) => {
  Logger.info(`Login attempt for email: ${req.body.email}`);
  const { email, password } = req.body;
  const { customer, accessToken, refreshToken } = await CustomerService.login(email, password);

  const settings = await SystemSettingRepository.getSettings();
  const isProduction = settings.appMode === 'Live';

  const cookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    secure: isProduction,
    sameSite: 'strict'
  };

  res.status(HTTP_STATUS.OK)
    .cookie('token', accessToken, cookieOptions)
    .json(new ApiResponse(HTTP_STATUS.OK, { customer, token: accessToken }, SUCCESS_MESSAGES.LOGIN_SUCCESS));
};

/**
 * @desc    Customer Signup
 * @route   POST /api/v1/customers/signup
 * @access  Public
 */
export const signup = async (req, res) => {
  Logger.info(`Signup request received for email: ${req.body.email}`);
  const result = await CustomerService.signup(req.body);
  
  res.status(HTTP_STATUS.CREATED).json(
    new ApiResponse(HTTP_STATUS.CREATED, result, 'Verification code sent to your email.')
  );
};

/**
 * @desc    Verify Email OTP
 * @route   POST /api/v1/customers/verify-otp
 * @access  Public
 */
export const verifyOtp = async (req, res) => {
  Logger.info(`OTP verification request for: ${req.body.email}`);
  const { email, code } = req.body;
  const result = await CustomerService.verifyOtp(email, code);
  
  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, SUCCESS_MESSAGES.OPERATION_SUCCESS)
  );
};

/**
 * @desc    Resend Verification OTP
 * @route   POST /api/v1/customers/resend-otp
 * @access  Public
 */
export const resendOtp = async (req, res) => {
  Logger.info(`Resend OTP request for: ${req.body.email}`);
  const { email } = req.body;
  const result = await CustomerService.resendOtp(email);
  
  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, 'Verification code resent.')
  );
};


/**
 * @desc    Forgot Password - Send OTP
 * @route   POST /api/v1/customers/forgot-password
 * @access  Public
 */
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const result = await CustomerService.forgotPassword(email);
  
  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, result.message)
  );
};

/**
 * @desc    Verify Reset OTP
 * @route   POST /api/v1/customers/verify-reset-otp
 * @access  Public
 */
export const verifyResetOtp = async (req, res) => {
  const { email, code } = req.body;
  const result = await CustomerService.verifyResetOtp(email, code);
  
  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, result.message)
  );
};

/**
 * @desc    Reset Password
 * @route   POST /api/v1/customers/reset-password
 * @access  Public
 */
export const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;
  const result = await CustomerService.resetPassword(email, code, newPassword);
  
  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, result.message)
  );
};

/**
 * @desc    Customer Logout
 * @route   POST /api/v1/customers/logout
 * @access  Private (Authenticated)
 */
export const logout = async (req, res) => {
  Logger.info(`Logout request received for customerId: ${req.customer?._id}`);
  const customerId = req.customer?._id;

  if (customerId) {
    await CustomerService.invalidateAllSessions(customerId);
  }

  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, {}, SUCCESS_MESSAGES.LOGOUT_SUCCESS));
};

/**
 * @desc    Get Current Customer Profile
 * @route   GET /api/v1/customers/me
 * @access  Private
 */
export const getMe = async (req, res) => {
  Logger.info(`getMe request for customer: ${req.customer?._id}`);
  const customer = await CustomerService.getProfile(req.customer._id);
  
  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, customer, SUCCESS_MESSAGES.OPERATION_SUCCESS)
  );
};

/**
 * @desc    Update Customer Profile
 * @route   PATCH /api/v1/customers/profile
 * @access  Private
 */
export const updateProfile = async (req, res) => {
  Logger.info(`updateProfile request for customer: ${req.customer?._id}`);
  const customer = await CustomerService.updateProfile(req.customer._id, req.body);
  
  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, customer, 'Profile updated successfully')
  );
};

export default {
  signup,
  verifyOtp,
  resendOtp,
  login,
  logout,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  getMe,
  updateProfile,
};
