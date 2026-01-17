import AdminService from '../services/admin.service.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import { ApiResponse } from '../utils/apiResponse.js';

class AdminController {
  /**
   * @desc    Admin login
   * @route   POST /api/v1/admin/auth/login
   * @access  Public
   */
  login = async (req, res) => {
    const { email, password, rememberMe } = req.body;

    const result = await AdminService.login(email, password, rememberMe);

    // 1. Refresh Token Cookie (Long Lived - The "Remember Me" part)
    // 30 days vs 1 day
    const refreshExpires = new Date(Date.now() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000);
    
    res.cookie('adminRefreshToken', result.tokens.refreshToken, {
      expires: refreshExpires,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // CSRF protection
    });

    // 2. Access Token Cookie (Short Lived)
    // Default 15 minutes or 1 hour. env.JWT_EXPIRE is 7d currently, we should verify.
    // If env is 7d, we can match it.
    // But for proper refresh flow, access token should be shorter.
    // We will set it to match JWT_EXPIRE or standard 1 day for now to avoid breaking existing logic too much.
    
    res.cookie('adminAccessToken', result.tokens.accessToken, {
      expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, SUCCESS_MESSAGES.LOGIN_SUCCESS));
  };

  /**
   * @desc    Refresh Access Token
   * @route   POST /api/v1/admin/auth/refresh-token
   * @access  Public (Cookie/Body)
   */
  refreshToken = async (req, res) => {
    // Get Refresh Token from Cookie (Secure) or Body (Fallback)
    const token = req.cookies?.adminRefreshToken || req.body.refreshToken;
    
    const result = await AdminService.refreshToken(token);
    
    // Set new Access Token Cookie
    res.cookie('adminAccessToken', result.accessToken, {
      expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Token Refreshed'));
  };

  /**
   * @desc    Admin logout
   * @route   POST /api/v1/admin/auth/logout
   * @access  Private (Admin)
   */
  logout = async (req, res) => {
    const options = {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    };
    
    res.cookie('adminAccessToken', 'none', options);
    res.cookie('adminRefreshToken', 'none', options);

    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, SUCCESS_MESSAGES.LOGOUT_SUCCESS));
  };

  /**
   * @desc    Get current admin profile
   * @route   GET /api/v1/admin/auth/me
   * @access  Private (Admin)
   */
  getMe = async (req, res) => {
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, {
      admin: {
        id: req.admin._id,
        name: req.admin.name,
        email: req.admin.email,
        phoneNumber: req.admin.phoneNumber,
        photo: req.admin.photo,
      },
    }, SUCCESS_MESSAGES.FETCHED));
  };

  /**
   * @desc    Update admin profile
   * @route   PATCH /api/v1/admin/auth/profile
   * @access  Private (Admin)
   */
  updateProfile = async (req, res) => {
    const result = await AdminService.updateProfile(req.admin._id, req.body);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, SUCCESS_MESSAGES.UPDATED));
  };

  /**
   * @desc    Update admin photo
   * @route   PATCH /api/v1/admin/auth/photo
   * @access  Private (Admin)
   */
  updatePhoto = async (req, res) => {
    if (!req.file) {
      throw new AppError('Photo is required', HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR');
    }

    const photo = await AdminService.updatePhoto(req.admin._id, req.file);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, photo, 'Photo updated successfully'));
  };

  /**
   * @desc    Delete admin photo
   * @route   DELETE /api/v1/admin/auth/photo
   * @access  Private (Admin)
   */
  deletePhoto = async (req, res) => {
    await AdminService.deletePhoto(req.admin._id);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, 'Photo deleted successfully'));
  };

  /**
   * @desc    Update admin password
   * @route   PATCH /api/v1/admin/auth/update-password
   * @access  Private (Admin)
   */
  updatePassword = async (req, res) => {
    const { newPassword } = req.body;
    await AdminService.updatePassword(req.admin._id, newPassword);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, 'Password updated successfully'));
  };

  /**
   * @desc    Forgot Password - Request OTP
   * @route   POST /api/v1/admin/auth/forgot-password
   * @access  Public
   */
  forgotPassword = async (req, res) => {
    const { email } = req.body;
    await AdminService.forgotPassword(email);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, 'OTP sent to your email'));
  };

  /**
   * @desc    Verify OTP
   * @route   POST /api/v1/admin/auth/verify-otp
   * @access  Public
   */
  verifyOtp = async (req, res) => {
    const { email, otp } = req.body;
    const result = await AdminService.verifyOtp(email, otp);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'OTP verified successfully'));
  };

  /**
   * @desc    Reset Password
   * @route   POST /api/v1/admin/auth/reset-password
   * @access  Public
   */
  resetPassword = async (req, res) => {
    const { resetToken, newPassword } = req.body;
    await AdminService.resetPassword(resetToken, newPassword);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, 'Password reset successfully. You can now login.'));
  };
}

export default new AdminController();
