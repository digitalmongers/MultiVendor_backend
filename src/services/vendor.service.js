import VendorRepository from '../repositories/vendor.repository.js';
import Vendor from '../models/vendor.model.js';
import EmailService from './email.service.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import vendorCache from '../utils/vendorCache.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS, ERROR_MESSAGES, VENDOR_STATUS } from '../constants.js';
import { generateToken, generateRefreshToken } from '../utils/jwt.js';
import AuditLogger from '../utils/audit.js';
import TransactionManager from '../utils/transaction.js';
import Logger from '../utils/logger.js';

class VendorService {
  /**
   * Signup Step 1: Basic account creation
   */
  async signupStep1(vendorData) {
    const { email } = vendorData;

    return await TransactionManager.execute(async (session) => {
      Logger.info(`Starting Vendor signup Step 1 for: ${email}`);

      const existingVendor = await VendorRepository.findByEmail(email);
      if (existingVendor) {
        throw new AppError('Email already registered', HTTP_STATUS.CONFLICT);
      }

      const vendor = await VendorRepository.create({
        ...vendorData,
        status: VENDOR_STATUS.INACTIVE, // Default status
        registrationStep: 1
      }, { session });

      AuditLogger.log('VENDOR_SIGNUP_STEP1_COMPLETE', 'VENDOR', { vendorId: vendor._id });

      return {
        id: vendor._id,
        email: vendor.email,
        message: 'Step 1 complete. Please proceed to Step 2.'
      };
    });
  }

  /**
   * Signup Step 2: Detailed information and business documents
   */
  async signupStep2(vendorId, step2Data) {
    const vendor = await VendorRepository.findById(vendorId, '', true);
    if (!vendor) {
      throw new AppError('Vendor account not found. Please complete Step 1.', HTTP_STATUS.NOT_FOUND);
    }

    if (vendor.registrationStep >= 2) {
        // Allow updates if needed, or prevent duplicate
    }

    // Update vendor with Step 2 data
    const updatedVendor = await VendorRepository.updateById(vendorId, {
      ...step2Data,
      registrationStep: 2,
      status: VENDOR_STATUS.PENDING // Now awaiting admin approval
    });

    Logger.info(`Vendor signup Step 2 complete for: ${vendor.email}`);
    AuditLogger.log('VENDOR_SIGNUP_STEP2_COMPLETE', 'VENDOR', { vendorId: vendor._id });

    // Send Welcome Email
    try {
      await EmailService.sendEmailTemplate(updatedVendor.email, 'Registration', { username: `${updatedVendor.firstName} ${updatedVendor.lastName}` });
      // Notify Admin using dynamic template
      await EmailService.sendEmailTemplate(env.EMAIL_FROM, 'Vendor Request', {
        email: updatedVendor.email,
        firstName: updatedVendor.firstName,
        lastName: updatedVendor.lastName,
        businessName: updatedVendor.businessName,
        phoneNumber: updatedVendor.phoneNumber
      }, 'admin');
    } catch (error) {
       Logger.error('Failed to send vendor signup emails', { error: error.message });
    }

    return {
      message: 'Account created successfully. Awaiting admin approval.',
      status: updatedVendor.status
    };
  }

  /**
   * Vendor Login
   */
  async login(email, password) {
    const vendor = await Vendor.findOne({ email }).select('+password +tokenVersion');
    
    if (!vendor) {
      throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    // Status check
    if (vendor.status !== VENDOR_STATUS.ACTIVE) {
      let message = 'Your account is not active.';
      if (vendor.status === VENDOR_STATUS.PENDING) message = 'Your account is pending admin approval.';
      if (vendor.status === VENDOR_STATUS.REJECTED) message = 'Your account has been rejected.';
      
      throw new AppError(message, HTTP_STATUS.FORBIDDEN);
    }

    const isMatch = await vendor.matchPassword(password);
    if (!isMatch) {
      AuditLogger.security('VENDOR_LOGIN_FAILED', { email });
      throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    // Reset token version or update last login
    await Vendor.updateOne({ _id: vendor._id }, { 
        lastLogin: new Date(),
        $inc: { tokenVersion: 1 } 
    });

    const updatedVendor = await VendorRepository.findById(vendor._id, '+tokenVersion');
    AuditLogger.log('VENDOR_LOGIN_SUCCESS', 'VENDOR', { vendorId: vendor._id });

    return {
      vendor: {
        id: updatedVendor._id,
        email: updatedVendor.email,
        businessName: updatedVendor.businessName,
        status: updatedVendor.status
      },
      ...this.generateTokens(updatedVendor)
    };
  }

  /**
   * Refresh Access Token
   */
  async refreshToken(token) {
    if (!token) {
      throw new AppError('Refresh token is required', HTTP_STATUS.UNAUTHORIZED);
    }

    try {
      const decoded = await import('jsonwebtoken').then(jwt => jwt.default.verify(token, process.env.JWT_REFRESH_SECRET));
      
      const vendor = await VendorRepository.findById(decoded.id, '+tokenVersion', true);
      if (!vendor) {
        throw new AppError('Vendor not found', HTTP_STATUS.UNAUTHORIZED);
      }

      // Token Versioning Check
      if (decoded.version !== vendor.tokenVersion) {
        throw new AppError('Session expired. Please login again.', HTTP_STATUS.UNAUTHORIZED);
      }

      // Status Check
      if (vendor.status !== VENDOR_STATUS.ACTIVE) {
        throw new AppError('Account is not active', HTTP_STATUS.FORBIDDEN);
      }

      const { accessToken } = this.generateTokens(vendor);
      return { accessToken };
    } catch (error) {
      throw new AppError('Invalid or expired refresh token', HTTP_STATUS.UNAUTHORIZED);
    }
  }

  /**
   * Update Vendor Profile
   */
  async updateProfile(vendorId, updateData) {
    // Security: Ensure email is not updatable
    delete updateData.email;
    delete updateData.password;
    delete updateData.role;
    delete updateData.status;
    delete updateData.tokenVersion;

    const vendor = await VendorRepository.updateById(vendorId, updateData);

    if (!vendor) {
      throw new AppError('Vendor not found', HTTP_STATUS.NOT_FOUND);
    }
    AuditLogger.log('VENDOR_PROFILE_UPDATED', 'VENDOR', { vendorId, updatedFields: Object.keys(updateData) });

    // CACHE INVALIDATION: Clear vendor caches for real-time updates
    await vendorCache.invalidateVendorCache(vendorId);

    return {
      message: 'Profile updated successfully',
      vendor: {
        id: vendor._id,
        firstName: vendor.firstName,
        lastName: vendor.lastName,
        businessName: vendor.businessName,
        businessAddress: vendor.businessAddress,
        phoneNumber: vendor.phoneNumber,
        businessTin: vendor.businessTin,
        taxAndLegal: vendor.taxAndLegal
      }
    };
  }

  /**
   * Update Vendor Bank Details
   */
  async updateBankDetails(vendorId, bankData) {
    const vendor = await VendorRepository.updateById(vendorId, { bankDetails: bankData });

    if (!vendor) {
      throw new AppError('Vendor not found', HTTP_STATUS.NOT_FOUND);
    }

    AuditLogger.log('VENDOR_BANK_DETAILS_UPDATED', 'VENDOR', { vendorId });

    // CACHE INVALIDATION: Clear vendor caches for real-time updates
    await vendorCache.invalidateVendorCache(vendorId);

    return {
      message: 'Bank details updated successfully',
      bankDetails: vendor.bankDetails
    };
  }

  /**
   * Update Vendor Image (Photo, Logo, Banner)
   */
  async updateImage(vendorId, file, field) {
    const allowedFields = ['photo', 'businessLogo', 'businessBanner'];
    if (!allowedFields.includes(field)) {
      throw new AppError('Invalid image field', HTTP_STATUS.BAD_REQUEST);
    }

    const vendor = await VendorRepository.findById(vendorId);
    if (!vendor) {
      throw new AppError('Vendor not found', HTTP_STATUS.NOT_FOUND);
    }

    // Delete old image if exists
    const oldImage = vendor[field];
    if (oldImage && oldImage.publicId) {
      await deleteFromCloudinary(oldImage.publicId);
    }

    // Upload new image
    const result = await uploadToCloudinary(file, `vendors/${vendorId}/${field}`);
    
    const updateData = {
      [field]: {
        url: result.secure_url,
        publicId: result.public_id,
      },
    };

    const updatedVendor = await VendorRepository.updateById(vendorId, updateData);
    AuditLogger.log(`VENDOR_${field.toUpperCase()}_UPDATED`, 'VENDOR', { vendorId });

    // CACHE INVALIDATION: Clear vendor caches for real-time updates
    await vendorCache.invalidateVendorCache(vendorId);

    return updatedVendor[field];
  }

  /**
   * Upload Vendor Documents (TIN Certificate, GST, PAN, Address Proof)
   */
  async uploadDocument(vendorId, file, documentType) {
    const vendor = await VendorRepository.findById(vendorId);
    if (!vendor) {
      throw new AppError('Vendor not found', HTTP_STATUS.NOT_FOUND);
    }

    // Validate document type
    const validDocTypes = ['tinCertificate', 'gstDocument', 'panDocument', 'addressProof'];
    if (!validDocTypes.includes(documentType)) {
      throw new AppError('Invalid document type', HTTP_STATUS.BAD_REQUEST);
    }

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(file.path, 'vendor-documents');

    // Delete old document if exists
    let oldPublicId = null;
    if (documentType === 'tinCertificate') {
      oldPublicId = vendor.businessTin?.certificate?.publicId;
    } else if (documentType === 'gstDocument') {
      oldPublicId = vendor.taxAndLegal?.gstDocument?.publicId;
    } else if (documentType === 'panDocument') {
      oldPublicId = vendor.taxAndLegal?.panDocument?.publicId;
    } else if (documentType === 'addressProof') {
      oldPublicId = vendor.taxAndLegal?.addressProof?.publicId;
    }

    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }

    // Update vendor with new document
    const updateData = {};
    if (documentType === 'tinCertificate') {
      updateData['businessTin.certificate'] = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      };
    } else if (documentType === 'gstDocument') {
      updateData['taxAndLegal.gstDocument'] = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      };
    } else if (documentType === 'panDocument') {
      updateData['taxAndLegal.panDocument'] = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      };
    } else if (documentType === 'addressProof') {
      updateData['taxAndLegal.addressProof'] = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      };
    }

    const updatedVendor = await VendorRepository.updateById(vendorId, updateData);
    AuditLogger.log(`VENDOR_${documentType.toUpperCase()}_UPLOADED`, 'VENDOR', { vendorId });

    // CACHE INVALIDATION: Clear vendor caches for real-time updates
    await vendorCache.invalidateVendorCache(vendorId);

    return {
      message: 'Document uploaded successfully',
      document: uploadResult.secure_url,
    };
  }

  /**
   * Admin: Create Vendor Account
   * Allows admin to create vendor accounts with compulsory and optional fields
   */
  async adminCreateVendor(vendorData, adminId) {
    // Check if vendor already exists
    const existingVendor = await VendorRepository.findByEmail(vendorData.email);
    if (existingVendor) {
      throw new AppError('Vendor with this email already exists', HTTP_STATUS.CONFLICT);
    }

    // Check phone number
    const existingPhone = await Vendor.findOne({ phoneNumber: vendorData.phoneNumber });
    if (existingPhone) {
      throw new AppError('Vendor with this phone number already exists', HTTP_STATUS.CONFLICT);
    }

    // Create vendor with transaction
    return await TransactionManager.executeTransaction(async (session) => {
      const vendor = await Vendor.create([{
        // Compulsory fields
        email: vendorData.email,
        phoneNumber: vendorData.phoneNumber,
        password: vendorData.password,
        firstName: vendorData.firstName,
        lastName: vendorData.lastName,

        // Optional fields
        businessName: vendorData.businessName,
        businessAddress: vendorData.businessAddress,
        businessTin: vendorData.businessTin,
        taxAndLegal: vendorData.taxAndLegal,
        bankDetails: vendorData.bankDetails,

        // Metadata
        status: VENDOR_STATUS.ACTIVE, // Admin-created vendors are active by default
        registrationStep: 2, // Mark as complete
        isEmailVerified: true, // Admin-created accounts are pre-verified
        
        // Track that this was admin-created
        createdBy: 'admin',
        createdByAdminId: adminId,
      }], { session });

      AuditLogger.log('VENDOR_CREATED_BY_ADMIN', 'ADMIN', { 
        vendorId: vendor[0]._id, 
        adminId,
        email: vendorData.email 
      });

      // CACHE INVALIDATION: Clear all vendor caches
      await vendorCache.invalidateAllVendorCaches();

      return {
        message: 'Vendor account created successfully',
        vendor: {
          id: vendor[0]._id,
          email: vendor[0].email,
          phoneNumber: vendor[0].phoneNumber,
          firstName: vendor[0].firstName,
          lastName: vendor[0].lastName,
          businessName: vendor[0].businessName,
          status: vendor[0].status,
        },
      };
    });
  }

  /**
   * Admin: Update Vendor Status (Approve, Reject, Suspend, Activate)
   */
  async updateStatus(vendorId, status) {
    if (!Object.values(VENDOR_STATUS).includes(status)) {
      throw new AppError('Invalid status', HTTP_STATUS.BAD_REQUEST);
    }

    const vendor = await VendorRepository.updateById(vendorId, { status });

    if (!vendor) {
      throw new AppError('Vendor not found', HTTP_STATUS.NOT_FOUND);
    }

    AuditLogger.log(`VENDOR_STATUS_UPDATED_${status.toUpperCase()}`, 'ADMIN', { vendorId, status });
    
    // CACHE INVALIDATION: Clear ALL vendor caches (status affects lists and filters)
    await vendorCache.invalidateAllVendorCaches();
    
    // Trigger Dynamic Emails
    try {
      if (status === VENDOR_STATUS.ACTIVE) {
        await EmailService.sendEmailTemplate(vendor.email, 'Registration Approved', { username: `${vendor.firstName} ${vendor.lastName}` });
      } else if (status === VENDOR_STATUS.INACTIVE) {
        await EmailService.sendEmailTemplate(vendor.email, 'Account Suspended', { username: `${vendor.firstName} ${vendor.lastName}` });
      }
    } catch (error) {
      Logger.error('Failed to send vendor status update email', { vendorId, status, error: error.message });
    }

    let message = `Vendor ${status} successfully`;
    if (status === VENDOR_STATUS.ACTIVE) message = 'Vendor activated successfully';
    if (status === VENDOR_STATUS.INACTIVE) message = 'Vendor suspended/deactivated successfully';

    return { message, vendor };
  }

  async approveVendor(vendorId) {
    return await this.updateStatus(vendorId, VENDOR_STATUS.ACTIVE);
  }

  async rejectVendor(vendorId) {
    // User requested status becomes inactive on reject
    return await this.updateStatus(vendorId, VENDOR_STATUS.INACTIVE);
  }

  async suspendVendor(vendorId) {
    return await this.updateStatus(vendorId, VENDOR_STATUS.INACTIVE);
  }

  async activateVendor(vendorId) {
    return await this.updateStatus(vendorId, VENDOR_STATUS.ACTIVE);
  }

  async deleteVendor(vendorId) {
    const vendor = await VendorRepository.deleteById(vendorId);
    if (!vendor) {
      throw new AppError('Vendor not found', HTTP_STATUS.NOT_FOUND);
    }
    AuditLogger.log('VENDOR_DELETED', 'ADMIN', { vendorId });

    // CACHE INVALIDATION: Clear ALL vendor caches
    await vendorCache.invalidateAllVendorCaches();

    return { message: 'Vendor account deleted successfully from database' };
  }

  /**
   * Admin: Get Vendor Details by ID
   * CACHED: 10 minutes TTL
   */
  async getVendorById(vendorId) {
    // Try cache first
    const cached = await vendorCache.getVendorDetail(vendorId);
    if (cached) {
      return cached;
    }

    // Cache miss - fetch from database
    const vendor = await VendorRepository.findById(vendorId);
    if (!vendor) {
      throw new AppError('Vendor not found', HTTP_STATUS.NOT_FOUND);
    }

    const vendorData = {
      id: vendor._id,
      email: vendor.email,
      phoneNumber: vendor.phoneNumber,
      
      // Personal Information
      firstName: vendor.firstName,
      lastName: vendor.lastName,
      photo: vendor.photo,
      
      // Business Information
      businessName: vendor.businessName,
      businessAddress: vendor.businessAddress,
      businessLogo: vendor.businessLogo,
      businessBanner: vendor.businessBanner,
      
      // Business TIN
      businessTin: vendor.businessTin,
      
      // Tax & Legal
      taxAndLegal: vendor.taxAndLegal,
      
      // Bank Details
      bankDetails: vendor.bankDetails,
      
      // Metadata
      status: vendor.status,
      role: vendor.role,
      registrationStep: vendor.registrationStep,
      isEmailVerified: vendor.isEmailVerified,
      
      // Timestamps
      registeredAt: vendor.createdAt,
      lastLogin: vendor.lastLogin,
      updatedAt: vendor.updatedAt,
    };

    // Cache the result
    await vendorCache.setVendorDetail(vendorId, vendorData);

    return vendorData;
  }

  /**
   * Admin: Get All Vendors with Pagination, Search, and Filtering
   * OPTIMIZED: Uses text index for search, lean queries, and field projection
   * CACHED: 5 minutes TTL for list queries
   */
  async getAllVendors(page = 1, limit = 10, status = null, search = null, exportMode = false) {
    // Skip cache for export mode (always fresh data for exports)
    if (!exportMode) {
      const cached = await vendorCache.getVendorList(page, limit, status, search);
      if (cached) {
        return cached;
      }
    }

    const filter = {};

    // Status filter
    if (status && Object.values(VENDOR_STATUS).includes(status)) {
      filter.status = status;
    }

    // OPTIMIZED: Use MongoDB text search instead of regex for better performance
    if (search) {
      filter.$text = { $search: search };
    }

    // Export mode - return all vendors without pagination
    if (exportMode) {
      const vendors = await Vendor.find(filter)
        .select('-password -tokenVersion') // Exclude sensitive fields
        .sort({ createdAt: -1 })
        .lean() // OPTIMIZATION: Convert to plain JS objects (faster)
        .exec();

      return vendors.map(vendor => ({
        id: vendor._id,
        email: vendor.email,
        phoneNumber: vendor.phoneNumber,
        firstName: vendor.firstName || '',
        lastName: vendor.lastName || '',
        businessName: vendor.businessName || '',
        businessAddress: vendor.businessAddress || '',
        status: vendor.status,
        registrationStep: vendor.registrationStep,
        bankName: vendor.bankDetails?.bankName || '',
        accountNumber: vendor.bankDetails?.accountNumber || '',
        ifscCode: vendor.bankDetails?.ifscCode || '',
        gstNumber: vendor.taxAndLegal?.gstNumber || '',
        panNumber: vendor.taxAndLegal?.panNumber || '',
        registeredAt: vendor.createdAt,
        lastLogin: vendor.lastLogin || 'Never',
      }));
    }

    // OPTIMIZED: Normal pagination mode with field projection
    const skip = (page - 1) * limit;
    
    // Only select fields needed for list view (reduces data transfer)
    const projection = {
      email: 1,
      phoneNumber: 1,
      firstName: 1,
      lastName: 1,
      businessName: 1,
      'photo.url': 1,
      'businessLogo.url': 1,
      status: 1,
      registrationStep: 1,
      lastLogin: 1,
      createdAt: 1,
    };

    const [vendors, total] = await Promise.all([
      Vendor.find(filter, projection)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean() // OPTIMIZATION: Convert to plain JS objects
        .exec(),
      Vendor.countDocuments(filter).exec(),
    ]);

    return {
      vendors: vendors.map(vendor => ({
        id: vendor._id,
        email: vendor.email,
        phoneNumber: vendor.phoneNumber,
        firstName: vendor.firstName,
        lastName: vendor.lastName,
        businessName: vendor.businessName,
        photo: vendor.photo,
        businessLogo: vendor.businessLogo,
        status: vendor.status,
        registrationStep: vendor.registrationStep,
        registeredAt: vendor.createdAt,
        lastLogin: vendor.lastLogin,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalVendors: total,
        limit,
      },
    };

    // Cache the result (only for non-export mode)
    if (!exportMode) {
      await vendorCache.setVendorList(page, limit, status, search, result);
    }

    return result;
  }

  /**
   * Update Vendor Password
   */
  async updatePassword(vendorId, newPassword) {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      throw new AppError('Vendor not found', HTTP_STATUS.NOT_FOUND);
    }

    vendor.password = newPassword;
    vendor.tokenVersion = (vendor.tokenVersion || 0) + 1;
    await vendor.save();

    AuditLogger.log('VENDOR_PASSWORD_CHANGED', 'VENDOR', { vendorId });

    // CACHE INVALIDATION
    await vendorCache.invalidateVendorCache(vendorId);

    return { message: 'Password updated successfully' };
  }

  /**
   * Secure Logout / Revoke All Sessions
   */
  async invalidateAllSessions(vendorId) {
    await Vendor.updateOne(
      { _id: vendorId },
      { $inc: { tokenVersion: 1 } }
    );
    AuditLogger.security('VENDOR_SESSIONS_REVOKED', { vendorId });
  }

  generateTokens(vendor) {
    const version = vendor.tokenVersion || 0;
    return {
      accessToken: generateToken(vendor._id, { version, role: vendor.role }),
      refreshToken: generateRefreshToken(vendor._id, { version, role: vendor.role }),
    };
  }
}

export default new VendorService();
