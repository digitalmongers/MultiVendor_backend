import CustomerRepository from '../repositories/customer.repository.js';
import Customer from '../models/customer.model.js';
import EmailService from './email.service.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../constants.js';
import { generateToken, generateRefreshToken } from '../utils/jwt.js';
import AuditLogger from '../utils/audit.js';
import TransactionManager from '../utils/transaction.js';
import Logger from '../utils/logger.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

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

      // 4. Send verification email
      try {
        await EmailService.sendVerificationEmail(email, verificationCode, 'customer');
        Logger.info(`Signup verification email sent to: ${email}`);
      } catch (error) {
        Logger.error('Signup Verification Email Delivery Failed', { 
          email, 
          error: error.message,
          stack: error.stack 
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
    // Atomic find AND update and unset OTP in one step
    // This is the CRITICAL PATTERN for preventing race conditions
    const customer = await Customer.findOneAndUpdate(
      { 
        email, 
        verificationCode: code, 
        verificationCodeExpires: { $gt: Date.now() },
        isVerified: false 
      },
      { 
        $unset: { verificationCode: 1, verificationCodeExpires: 1 },
        $set: { isVerified: true }
      },
      { new: true }
    );

    if (!customer) {
      Logger.warn(`OTP verification failure for email: ${email}`);
      // We don't distinguish between "wrong code" and "expired code" to prevent side-channel timing attacks
      throw new AppError('Invalid or expired verification code.', HTTP_STATUS.BAD_REQUEST);
    }

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
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    const customer = await Customer.findOneAndUpdate(
      { email, isVerified: false },
      { 
        $set: { 
          verificationCode, 
          verificationCodeExpires 
        } 
      },
      { new: true }
    );

    if (!customer) {
      throw new AppError('Either account is already verified or not found.', HTTP_STATUS.BAD_REQUEST);
    }

    await EmailService.sendVerificationEmail(email, verificationCode, 'customer');

    return {
      message: 'Verification code resent successfully.'
    };
  }

  /**
   * Customer Login (Account Lockout Logic)
   */
  async login(email, password) {
    const customer = await Customer.findOne({ email }).select('+password +loginAttempts +lockUntil');
    
    if (!customer) {
      throw new AppError("Don't have an account? Please sign up.", HTTP_STATUS.UNAUTHORIZED);
    }

    // 1. Check if account is locked
    if (customer.lockUntil && customer.lockUntil > Date.now()) {
      AuditLogger.security('CUSTOMER_LOGIN_LOCKED_ATTEMPT', { email });
      throw new AppError(`Account is temporarily locked. Please try again in 2 hours.`, HTTP_STATUS.FORBIDDEN);
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
            lockUntil: customer.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCK_TIME : undefined 
          }
        }
      );

      AuditLogger.security('CUSTOMER_LOGIN_FAILED', { email });
      
      const remaining = MAX_LOGIN_ATTEMPTS - (customer.loginAttempts + 1);
      const message = remaining > 0 
        ? `Wrong password. ${remaining} attempts remaining before lockout.`
        : 'Too many failed attempts. Your account has been locked for 2 hours.';
        
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
    const customer = await Customer.findOne({ email });
    
    if (!customer) {
       throw new AppError("Account not found with this email.", HTTP_STATUS.NOT_FOUND);
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Atomic update reset code
    await Customer.updateOne(
      { _id: customer._id },
      { 
        $set: { 
          verificationCode: resetCode, 
          verificationCodeExpires: resetCodeExpires 
        } 
      }
    );

    await EmailService.sendPasswordResetOtpEmail(email, resetCode, 'customer');

    AuditLogger.log('CUSTOMER_FORGOT_PASSWORD_REQUESTED', 'CUSTOMER', { customerId: customer._id });

    return {
      message: 'Verification code sent to your email.'
    };
  }

  /**
   * Forgot Password - Step 2: Verify OTP
   */
  async verifyResetOtp(email, code) {
    const customer = await Customer.findOne({ 
      email, 
      verificationCode: code, 
      verificationCodeExpires: { $gt: Date.now() } 
    });

    if (!customer) {
      throw new AppError('Invalid or expired verification code.', HTTP_STATUS.BAD_REQUEST);
    }

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

    // Trigger Dynamic Emails
    try {
      const event = isActive ? 'Account Unblocked' : 'Account Blocked';
      await EmailService.sendEmailTemplate(customer.email, event, { username: customer.name }, 'customer');
    } catch (error) {
      Logger.error(`Failed to send customer status update email`, { customerId, isActive, error: error.message });
    }

    AuditLogger.log(`CUSTOMER_ACCOUNT_${isActive ? 'UNBLOCKED' : 'BLOCKED'}`, 'ADMIN', { customerId });
    return customer;
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
