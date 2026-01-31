import SystemSettingRepository from '../repositories/systemSetting.repository.js';
import AdminService from '../services/admin.service.js';
import VendorService from '../services/vendor.service.js';
import CustomerService from '../services/customer.service.js';
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

    // 1. Authenticate Admin
    const result = await AdminService.login(email, password, rememberMe);

    // 2. Fetch Dynamic System Settings (for secure cookies)
    const settings = await SystemSettingRepository.getSettings();
    const isProduction = settings.appMode === 'Live';

    // 3. Set Refresh Token Cookie (Long Lived)
    const refreshExpires = new Date(Date.now() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000);
    
    res.cookie('adminRefreshToken', result.tokens.refreshToken, {
      expires: refreshExpires,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    });

    // 4. Set Access Token Cookie (Short Lived)
    res.cookie('adminAccessToken', result.tokens.accessToken, {
      expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
      httpOnly: true,
      secure: isProduction,
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
    
    // Dynamic System Settings
    const settings = await SystemSettingRepository.getSettings();
    const isProduction = settings.appMode === 'Live';

    // Set new Access Token Cookie
    res.cookie('adminAccessToken', result.accessToken, {
      expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    });

    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Token Refreshed'));
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

  resetPassword = async (req, res) => {
    const { resetToken, newPassword } = req.body;
    await AdminService.resetPassword(resetToken, newPassword);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, 'Password reset successfully. You can now login.'));
  };

  approveVendor = async (req, res) => {
    const { vendorId } = req.params;
    const result = await VendorService.approveVendor(vendorId);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
  };

  /**
   * @desc    Reject Vendor
   * @route   PATCH /api/v1/admin/auth/vendors/:vendorId/reject
   * @access  Private (Admin)
   */
  rejectVendor = async (req, res) => {
    const { vendorId } = req.params;
    const result = await VendorService.rejectVendor(vendorId);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
  };

  /**
   * @desc    Suspend Vendor
   * @route   PATCH /api/v1/admin/auth/vendors/:vendorId/suspend
   * @access  Private (Admin)
   */
  suspendVendor = async (req, res) => {
    const { vendorId } = req.params;
    const result = await VendorService.suspendVendor(vendorId);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
  };

  /**
   * @desc    Activate Vendor
   * @route   PATCH /api/v1/admin/auth/vendors/:vendorId/activate
   * @access  Private (Admin)
   */
  activateVendor = async (req, res) => {
    const { vendorId } = req.params;
    const result = await VendorService.activateVendor(vendorId);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
  };

  /**
   * @desc    Delete Vendor
   * @route   DELETE /api/v1/admin/auth/vendors/:vendorId
   * @access  Private (Admin)
   */
  deleteVendor = async (req, res) => {
    const { vendorId } = req.params;
    const result = await VendorService.deleteVendor(vendorId);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
  };

  /**
   * @desc    Get Vendor Details by ID
   * @route   GET /api/v1/admin/auth/vendors/:vendorId
   * @access  Private (Admin)
   */
  getVendorById = async (req, res) => {
    const { vendorId } = req.params;
    const vendor = await VendorService.getVendorById(vendorId);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, vendor, 'Vendor details retrieved successfully'));
  };

  /**
   * @desc    Get All Vendors
   * @route   GET /api/v1/admin/auth/vendors
   * @access  Private (Admin)
   */
  getAllVendors = async (req, res) => {
    const { page = 1, limit = 10, status, search } = req.query;
    const result = await VendorService.getAllVendors(Number(page), Number(limit), status, search, false);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Vendors retrieved successfully'));
  };

  /**
   * @desc    Create Vendor Account (Admin)
   * @route   POST /api/v1/admin/auth/vendors
   * @access  Private (Admin)
   */
  createVendor = async (req, res) => {
    const adminId = req.user._id; // Get admin ID from authenticated request
    const result = await VendorService.adminCreateVendor(req.body, adminId);
    return res.status(HTTP_STATUS.CREATED).json(new ApiResponse(HTTP_STATUS.CREATED, result, result.message));
  };

  /**
   * @desc    Export All Vendors to CSV
   * @route   GET /api/v1/admin/auth/vendors/export
   * @access  Private (Admin)
   */
  exportVendors = async (req, res) => {
    const { status, search } = req.query;
    const vendors = await VendorService.getAllVendors(1, 10, status, search, true);

    // CSV Headers
    const headers = [
      'ID',
      'Email',
      'Phone Number',
      'First Name',
      'Last Name',
      'Business Name',
      'Business Address',
      'Status',
      'Registration Step',
      'Bank Name',
      'Account Number',
      'IFSC Code',
      'GST Number',
      'PAN Number',
      'Registered At',
      'Last Login',
    ];

    // Convert to CSV
    const csvRows = [headers.join(',')];
    vendors.forEach(vendor => {
      const row = [
        vendor.id,
        vendor.email,
        vendor.phoneNumber,
        vendor.firstName,
        vendor.lastName,
        vendor.businessName,
        `"${vendor.businessAddress}"`, // Quoted for addresses with commas
        vendor.status,
        vendor.registrationStep,
        vendor.bankName,
        vendor.accountNumber,
        vendor.ifscCode,
        vendor.gstNumber,
        vendor.panNumber,
        new Date(vendor.registeredAt).toLocaleDateString(),
        vendor.lastLogin === 'Never' ? 'Never' : new Date(vendor.lastLogin).toLocaleDateString(),
      ];
      csvRows.push(row.join(','));
    });

    const csv = csvRows.join('\n');

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=vendors_${Date.now()}.csv`);
    return res.status(HTTP_STATUS.OK).send(csv);
  };
  /**
   * @desc    Upload TIN Certificate for a Vendor (Admin)
   * @route   PATCH /api/v1/admin/auth/vendors/:vendorId/documents/tin-certificate
   * @access  Private (Admin)
   */
  uploadVendorTinCertificate = async (req, res) => {
    const { vendorId } = req.params;
    if (!req.file) {
      throw new AppError('Please upload a file', HTTP_STATUS.BAD_REQUEST);
    }
    const result = await VendorService.uploadDocument(vendorId, req.file, 'tinCertificate');
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
  };

  /**
   * @desc    Upload GST Document for a Vendor (Admin)
   * @route   PATCH /api/v1/admin/auth/vendors/:vendorId/documents/gst-document
   * @access  Private (Admin)
   */
  uploadVendorGstDocument = async (req, res) => {
    const { vendorId } = req.params;
    if (!req.file) {
      throw new AppError('Please upload a file', HTTP_STATUS.BAD_REQUEST);
    }
    const result = await VendorService.uploadDocument(vendorId, req.file, 'gstDocument');
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
  };

  /**
   * @desc    Upload PAN Document for a Vendor (Admin)
   * @route   PATCH /api/v1/admin/auth/vendors/:vendorId/documents/pan-document
   * @access  Private (Admin)
   */
  uploadVendorPanDocument = async (req, res) => {
    const { vendorId } = req.params;
    if (!req.file) {
      throw new AppError('Please upload a file', HTTP_STATUS.BAD_REQUEST);
    }
    const result = await VendorService.uploadDocument(vendorId, req.file, 'panDocument');
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
  };

  /**
   * @desc    Upload Address Proof for a Vendor (Admin)
   * @route   PATCH /api/v1/admin/auth/vendors/:vendorId/documents/address-proof
   * @access  Private (Admin)
   */
  uploadVendorAddressProof = async (req, res) => {
    const { vendorId } = req.params;
    if (!req.file) {
      throw new AppError('Please upload a file', HTTP_STATUS.BAD_REQUEST);
    }
    const result = await VendorService.uploadDocument(vendorId, req.file, 'addressProof');
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, result.message));
  };

  /**
   * CUSTOMER MANAGEMENT
   */

  /**
   * @desc    Get All Customers
   * @route   GET /api/v1/admin/auth/customers
   * @access  Private (Admin)
   */
  getAllCustomers = async (req, res) => {
    const { page = 1, limit = 10, search, status } = req.query;
    const result = await CustomerService.getAllCustomers(Number(page), Number(limit), search, status);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Customers retrieved successfully'));
  };

  /**
   * @desc    Toggle Customer Status
   * @route   PATCH /api/v1/admin/auth/customers/:customerId/toggle-status
   * @access  Private (Admin)
   */
  toggleCustomerStatus = async (req, res) => {
    const { customerId } = req.params;
    const { isActive } = req.body;
    
    if (isActive === undefined) {
      throw new AppError('isActive status is required', HTTP_STATUS.BAD_REQUEST);
    }

    const result = await CustomerService.updateStatus(customerId, isActive);
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, `Customer account ${isActive ? 'activated' : 'deactivated'} successfully`));
  };
}

export default new AdminController();
