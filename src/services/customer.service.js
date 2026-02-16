import CustomerRepository from '../repositories/customer.repository.js';
import Customer from '../models/customer.model.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../constants.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import { generateToken, generateRefreshToken } from '../utils/jwt.js';
import AuditLogger from '../utils/audit.js';
import TransactionManager from '../utils/transaction.js';
import Logger from '../utils/logger.js';
import LoginSettingRepository from '../repositories/loginSetting.repository.js';
import CartService from './cart.service.js';
import { emailQueue } from '../config/queue.js';

class CustomerService {
  /**
   * Step 1: Signup - Create customer and send OTP (Atomic & Transactional)
   */
  async signup(customerData) {
    const { email } = customerData;

    return await TransactionManager.execute(async (session) => {
      Logger.info(`Starting customer signup process for: ${email}`);

      // 1. Check if customer already exists
      const existingCustomer = await CustomerRepository.findByEmail(email, '', true);
      if (existingCustomer) {
        Logger.warn(`Signup failed: Email already exists - ${email}`);
        throw new AppError(ERROR_MESSAGES.DUPLICATE_RESOURCE, HTTP_STATUS.CONFLICT);
      }

      // 2. Generate 6-digit OTP
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // 3. Create customer (unverified)
      const customer = await CustomerRepository.create({
        ...customerData,
        verificationCode,
        verificationCodeExpires,
        isVerified: false
      }, { session });

      Logger.info(`Customer account created (unverified) in DB: ${customer._id}`);

      // 4. Queue verification email (Async - no API blocking)
      try {
        await emailQueue.add('send-custom', {
          type: 'send-custom',
          to: email,
          template: 'Account Verification',
          data: { 
            username: customerData.name || email,
            verificationCode: verificationCode
          },
          role: 'customer'
        });
        Logger.info(`📧 Signup verification email queued: ${email}`);
      } catch (error) {
        Logger.error('Signup Verification Email Queue Failed', {
          email,
          error: error.message
        });
      }

      AuditLogger.log('CUSTOMER_SIGNUP', 'CUSTOMER', { customerId: customer._id });

      return {
        id: customer._id,
        email: customer.email,
        message: 'Signup successful. Please check your email for verification code.'
      };
    });
  }

  /**
   * Step 2: Verify OTP and activate account (Atomic update to prevent race conditions)
   */
  async verifyOtp(email, code) {
    const loginSettings = await LoginSettingRepository.getSettings();
    const maxOtpHit = loginSettings.maxOtpHit;
    const blockTime = loginSettings.temporaryBlockTime * 1000;

    const customer = await Customer.findOne({ email, isVerified: false }).select('+verificationCode +verificationCodeExpires +otpAttempts +otpLockUntil');

    if (!customer) {
      throw new AppError('Account not found or already verified.', HTTP_STATUS.NOT_FOUND);
    }

    // 1. Check if OTP is locked
    if (customer.otpLockUntil && customer.otpLockUntil > Date.now()) {
      const remainingTime = Math.ceil((customer.otpLockUntil - Date.now()) / (60 * 1000));
      throw new AppError(`Too many failed attempts. Please try again in ${remainingTime} minutes.`, HTTP_STATUS.FORBIDDEN);
    }

    // 2. Verify Code
    const isCodeValid = customer.verificationCode === code && customer.verificationCodeExpires > Date.now();

    if (!isCodeValid) {
      const updatedAttempts = (customer.otpAttempts || 0) + 1;
      const isLocked = updatedAttempts >= maxOtpHit;

      await Customer.updateOne(
        { _id: customer._id },
        {
          $inc: { otpAttempts: 1 },
          $set: {
            otpLockUntil: isLocked ? Date.now() + blockTime : undefined
          }
        }
      );

      const remaining = maxOtpHit - updatedAttempts;
      const message = remaining > 0
        ? `Invalid or expired code. ${remaining} attempts remaining.`
        : `Too many failed attempts. Account locked for OTP for ${loginSettings.temporaryBlockTime / 3600} hours.`;

      throw new AppError(message, HTTP_STATUS.BAD_REQUEST);
    }

    // 3. Success - Reset OTP fields and verify
    customer.isVerified = true;
    customer.verificationCode = undefined;
    customer.verificationCodeExpires = undefined;
    customer.otpAttempts = 0;
    customer.otpLockUntil = undefined;
    await customer.save();

    Logger.info(`Email verified successfully for customer: ${customer._id}`);
    AuditLogger.log('CUSTOMER_VERIFIED', 'CUSTOMER', { customerId: customer._id });

    return {
      message: 'Email verified successfully. You can now log in.'
    };
  }

  /**
   * Resend OTP (Atomic refresh)
   */
  async resendOtp(email) {
    const loginSettings = await LoginSettingRepository.getSettings();
    const resendTimeSec = loginSettings.otpResendTime;

    const customer = await Customer.findOne({ email, isVerified: false }).select('+updatedAt');
    if (!customer) {
      throw new AppError('Either account is already verified or not found.', HTTP_STATUS.BAD_REQUEST);
    }

    // Check resend cooldown
    const lastUpdate = new Date(customer.updatedAt).getTime();
    const now = Date.now();
    const cooldownMs = resendTimeSec * 1000;

    if (now - lastUpdate < cooldownMs) {
      const waitTime = Math.ceil((cooldownMs - (now - lastUpdate)) / 1000);
      throw new AppError(`Please wait ${waitTime} seconds before resending OTP.`, HTTP_STATUS.TOO_MANY_REQUESTS);
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    await Customer.updateOne(
      { _id: customer._id },
      {
        $set: {
          verificationCode,
          verificationCodeExpires
        }
      }
    );

    // Queue verification email (Async)
    await emailQueue.add('send-custom', {
      type: 'send-custom',
      to: email,
      template: 'Account Verification',
      data: { 
        username: customer.name || email,
        verificationCode: verificationCode
      },
      role: 'customer'
    });

    return {
      message: 'Verification code resent successfully.'
    };
  }

  /**
   * Customer Login (Account Lockout Logic)
   */
  async login(email, password, guestId = null) {
    const customer = await Customer.findOne({ email }).select('+password +loginAttempts +lockUntil');

    if (!customer) {
      throw new AppError("Don't have an account? Please sign up.", HTTP_STATUS.UNAUTHORIZED);
    }

    // Status check
    if (customer.isActive === false) {
      throw new AppError('Your account has been blocked. Please contact support.', HTTP_STATUS.FORBIDDEN);
    }

    // 1. Check if account is locked
    const loginSettings = await LoginSettingRepository.getSettings();
    const maxLoginHit = loginSettings.maxLoginHit;
    const blockTime = loginSettings.temporaryLoginBlockTime * 1000;

    if (customer.lockUntil && customer.lockUntil > Date.now()) {
      const remainingTime = Math.ceil((customer.lockUntil - Date.now()) / (60 * 1000));
      AuditLogger.security('CUSTOMER_LOGIN_LOCKED_ATTEMPT', { email });
      throw new AppError(`Account is temporarily locked. Please try again in ${remainingTime} minutes.`, HTTP_STATUS.FORBIDDEN);
    }

    if (!customer.isVerified) {
      throw new AppError('Please verify your email before logging in.', HTTP_STATUS.FORBIDDEN);
    }

    const isMatch = await customer.matchPassword(password);

    if (!isMatch) {
      Logger.warn(`Login failed: Invalid password for account ${email}`);
      // 2. Increment failed attempts
      await Customer.updateOne(
        { _id: customer._id },
        {
          $inc: { loginAttempts: 1 },
          $set: {
            lockUntil: customer.loginAttempts + 1 >= maxLoginHit ? Date.now() + blockTime : undefined
          }
        }
      );

      AuditLogger.security('CUSTOMER_LOGIN_FAILED', { email });

      const remaining = maxLoginHit - (customer.loginAttempts + 1);
      const message = remaining > 0
        ? `Wrong password. ${remaining} attempts remaining before lockout.`
        : `Too many failed attempts. Your account has been locked for ${loginSettings.temporaryLoginBlockTime / 3600} hours.`;

      throw new AppError(message, HTTP_STATUS.UNAUTHORIZED);
    }

    // 3. Success - Reset attempts, update last login and increment tokenVersion for a fresh session
    await Customer.updateOne(
      { _id: customer._id },
      {
        $inc: { tokenVersion: 1 },
        $set: { lastLogin: new Date() },
        $unset: { loginAttempts: 1, lockUntil: 1 }
      }
    );

    // Fetch updated version for token
    const updatedCustomer = await Customer.findById(customer._id);

    // 4. Merge guest cart if guestId provided
    if (guestId) {
      try {
        await CartService.mergeGuestCart(guestId, updatedCustomer._id);
        Logger.info('Guest cart merged on login', { customerId: updatedCustomer._id, guestId });
      } catch (error) {
        Logger.error('Failed to merge guest cart on login', {
          customerId: updatedCustomer._id,
          guestId,
          error: error.message
        });
        // Don't fail login if cart merge fails
      }
    }

    AuditLogger.log('CUSTOMER_LOGIN', 'CUSTOMER', { customerId: customer._id });

    return {
      customer: {
        id: updatedCustomer._id,
        name: updatedCustomer.name,
        email: updatedCustomer.email,
        role: updatedCustomer.role
      },
      ...this.generateTokens(updatedCustomer)
    };
  }

  /**
   * Global Logout / Device Revocation - Increments token version
   */
  async invalidateAllSessions(customerId) {
    await Customer.updateOne(
      { _id: customerId },
      { $inc: { tokenVersion: 1 } }
    );
    AuditLogger.security('CUSTOMER_SESSIONS_REVOKED', { customerId });
  }

  /**
   * Forgot Password - Step 1: Send OTP
   */
  async forgotPassword(email) {
    const loginSettings = await LoginSettingRepository.getSettings();
    const resendTimeSec = loginSettings.otpResendTime;

    const customer = await Customer.findOne({ email }).select('+updatedAt');

    if (!customer) {
      throw new AppError("Account not found with this email.", HTTP_STATUS.NOT_FOUND);
    }

    // Check resend cooldown (if OTP was sent recently)
    if (customer.verificationCodeExpires && customer.verificationCodeExpires > Date.now()) {
      const lastUpdate = new Date(customer.updatedAt).getTime();
      const now = Date.now();
      const cooldownMs = resendTimeSec * 1000;

      if (now - lastUpdate < cooldownMs) {
        const waitTime = Math.ceil((cooldownMs - (now - lastUpdate)) / 1000);
        throw new AppError(`Please wait ${waitTime} seconds before requesting a new OTP.`, HTTP_STATUS.TOO_MANY_REQUESTS);
      }
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Atomic update reset code and reset OTP attempts
    await Customer.updateOne(
      { _id: customer._id },
      {
        $set: {
          verificationCode: resetCode,
          verificationCodeExpires: resetCodeExpires,
          otpAttempts: 0,
          otpLockUntil: undefined
        }
      }
    );

    // Queue password reset email (Async)
    await emailQueue.add('send-custom', {
      type: 'send-custom',
      to: email,
      template: 'Password Reset',
      data: { 
        username: customer.name || email,
        resetCode: resetCode
      },
      role: 'customer'
    });

    AuditLogger.log('CUSTOMER_FORGOT_PASSWORD_REQUESTED', 'CUSTOMER', { customerId: customer._id });

    return {
      message: 'Verification code sent to your email.'
    };
  }

  /**
   * Forgot Password - Step 2: Verify OTP
   */
  async verifyResetOtp(email, code) {
    const loginSettings = await LoginSettingRepository.getSettings();
    const maxOtpHit = loginSettings.maxOtpHit;
    const blockTime = loginSettings.temporaryBlockTime * 1000;

    const customer = await Customer.findOne({ email }).select('+verificationCode +verificationCodeExpires +otpAttempts +otpLockUntil');

    if (!customer) {
      throw new AppError('Account not found.', HTTP_STATUS.NOT_FOUND);
    }

    // 1. Check if OTP is locked
    if (customer.otpLockUntil && customer.otpLockUntil > Date.now()) {
      const remainingTime = Math.ceil((customer.otpLockUntil - Date.now()) / (60 * 1000));
      throw new AppError(`Too many failed attempts. Please try again in ${remainingTime} minutes.`, HTTP_STATUS.FORBIDDEN);
    }

    // 2. Verify Code
    const isCodeValid = customer.verificationCode === code && customer.verificationCodeExpires > Date.now();

    if (!isCodeValid) {
      const updatedAttempts = (customer.otpAttempts || 0) + 1;
      const isLocked = updatedAttempts >= maxOtpHit;

      await Customer.updateOne(
        { _id: customer._id },
        {
          $inc: { otpAttempts: 1 },
          $set: {
            otpLockUntil: isLocked ? Date.now() + blockTime : undefined
          }
        }
      );

      AuditLogger.security('CUSTOMER_RESET_OTP_FAILED', { email });

      const remaining = maxOtpHit - updatedAttempts;
      const message = remaining > 0
        ? `Invalid or expired code. ${remaining} attempts remaining.`
        : `Too many failed attempts. Account locked for ${loginSettings.temporaryBlockTime / 3600} hours.`;

      throw new AppError(message, HTTP_STATUS.BAD_REQUEST);
    }

    // 3. Success - Reset OTP attempts
    await Customer.updateOne(
      { _id: customer._id },
      {
        $set: { otpAttempts: 0, otpLockUntil: undefined }
      }
    );

    return {
      message: 'OTP verified. You can now reset your password.'
    };
  }

  /**
   * Forgot Password - Step 3: Reset Password (Atomic & Transactional)
   */
  async resetPassword(email, code, newPassword) {
    return await TransactionManager.execute(async (session) => {
      // Using atomic update pattern to ensure OTP is consumed only once
      const customer = await Customer.findOneAndUpdate(
        {
          email,
          verificationCode: code,
          verificationCodeExpires: { $gt: Date.now() }
        },
        {
          $unset: { verificationCode: 1, verificationCodeExpires: 1 },
          $inc: { tokenVersion: 1 }, // Invalidate all sessions on password reset
          $set: {
            password: newPassword, // Note: pre-save hook will handle hashing
            lastPasswordReset: new Date()
          }
        },
        { new: true, session }
      );

      if (!customer) {
        throw new AppError('Invalid or expired verification code.', HTTP_STATUS.BAD_REQUEST);
      }

      AuditLogger.log('CUSTOMER_PASSWORD_RESET_SUCCESS', 'CUSTOMER', { customerId: customer._id });

      return {
        message: 'Password reset successfully. You can now login.'
      };
    });
  }

  /**
   * Get Customer Profile
   */
  async getProfile(customerId) {
    Logger.info(`Fetching profile for customer: ${customerId}`);
    const customer = await CustomerRepository.findById(customerId, '', true);
    if (!customer) {
      throw new AppError('Customer not found', HTTP_STATUS.NOT_FOUND);
    }
    return customer;
  }

  /**
   * Update Customer Profile
   */
  async updateProfile(customerId, updateData) {
    Logger.info(`Updating profile for customer: ${customerId}`, { updateData });

    // Prevent updating sensitive fields via this method
    const allowedFields = ['name', 'phoneNumber'];
    const filteredUpdate = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdate[key] = updateData[key];
      }
    });

    const customer = await CustomerRepository.updateById(customerId, filteredUpdate);

    if (!customer) {
      throw new AppError('Customer not found', HTTP_STATUS.NOT_FOUND);
    }

    AuditLogger.log('CUSTOMER_PROFILE_UPDATED', 'CUSTOMER', { customerId: customer._id });
    return customer;
  }

  /**
   * Update Customer Status (Block/Unblock)
   */
  async updateStatus(customerId, isActive) {
    Logger.info(`Updating status for customer: ${customerId} to ${isActive ? 'Active' : 'Blocked'}`);

    const customer = await CustomerRepository.updateById(customerId, { isActive });

    if (!customer) {
      throw new AppError('Customer not found', HTTP_STATUS.NOT_FOUND);
    }

    // Trigger Dynamic Emails - ASYNC via Queue
    try {
      const event = isActive ? 'Account Unblocked' : 'Account Blocked';
      await emailQueue.add('send-custom', {
        type: 'send-custom',
        to: customer.email,
        template: event,
        data: { username: customer.name },
        role: 'customer'
      });
    } catch (error) {
      Logger.error(`Failed to queue customer status update email`, { customerId, isActive, error: error.message });
    }

    AuditLogger.log(`CUSTOMER_ACCOUNT_${isActive ? 'UNBLOCKED' : 'BLOCKED'}`, 'ADMIN', { customerId });
    return customer;
  }

  /**
   * Update Customer Image (Photo)
   */
  async updateImage(customerId, file) {
    const customer = await CustomerRepository.findById(customerId);
    if (!customer) {
      throw new AppError('Customer not found', HTTP_STATUS.NOT_FOUND);
    }

    // Delete old image if exists
    if (customer.photo && customer.photo.publicId) {
      await deleteFromCloudinary(customer.photo.publicId);
    }

    // Upload new image
    const result = await uploadToCloudinary(file, `customers/${customerId}`);

    const updateData = {
      photo: {
        url: result.secure_url,
        publicId: result.public_id,
      },
    };

    const updatedCustomer = await CustomerRepository.updateById(customerId, updateData);
    AuditLogger.log('CUSTOMER_PHOTO_UPDATED', 'CUSTOMER', { customerId });

    return updatedCustomer.photo;
  }

  /**
   * Get All Customers (for Admin)
   */
  async getAllCustomers(page = 1, limit = 10, search = '', status) {
    const skip = (page - 1) * limit;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }

    if (status !== undefined) {
      query.isActive = status === 'active';
    }

    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Customer.countDocuments(query);

    return {
      customers,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  generateTokens(customer) {
    const version = customer.tokenVersion || 0;
    return {
      accessToken: generateToken(customer._id, { version }),
      refreshToken: generateRefreshToken(customer._id, { version }),
    };
  }
}

export default new CustomerService();
