import AdminRepository from '../repositories/admin.repository.js';

import AppError from '../utils/AppError.js';

import { HTTP_STATUS, ERROR_MESSAGES } from '../constants.js';

import { generateToken, generateRefreshToken } from '../utils/jwt.js';

import jwt from 'jsonwebtoken';

import AuditLogger from '../utils/audit.js';

import env from '../config/env.js';

import Logger from '../utils/logger.js';

import { emailQueue } from '../config/queue.js';

import crypto from 'crypto';

import Cache from '../utils/cache.js';



import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';



const ADMIN_CACHE_PREFIX = 'admin:profile:';

const ADMIN_RESPONSE_CACHE_PREFIX = 'response:admin:';



class AdminService {

  /**

   * Helper to invalidate all admin caches

   */

  async invalidateAdminCache(adminId) {

    await Cache.del(`${ADMIN_CACHE_PREFIX}${adminId}`);

    await Cache.delByPattern(`${ADMIN_RESPONSE_CACHE_PREFIX}${adminId}:*`);

    Logger.debug(`Admin Cache Invalidated: ${adminId}`);

  }

  /**

   * Admin Login logic with "Remember Me"

   */

  async login(email, password, rememberMe = false) {

    const admin = await AdminRepository.findByEmail(email, true);



    if (!admin) {

      throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED, 'INVALID_ADMIN_AUTH');

    }



    // Check availability (Lockout)

    if (admin.lockoutUntil && admin.lockoutUntil > Date.now()) {

      throw new AppError('Account is temporarily locked due to too many failed login attempts. Please try again later.', HTTP_STATUS.TOO_MANY_REQUESTS, 'ACCOUNT_LOCKED');

    }



    const isMatch = await admin.matchPassword(password);

    if (!isMatch) {

      // Increment login attempts

      const attempts = (admin.loginAttempts || 0) + 1;

      const updateData = { loginAttempts: attempts };



      // Lock if 5 attempts reached

      if (attempts >= 5) {

        updateData.lockoutUntil = Date.now() + 15 * 60 * 1000; // 15 minutes

        updateData.loginAttempts = 0; // Optional: Reset or keep to show history. Let's reset after lockout ends, but for now just set timeout.



        await AdminRepository.updateById(admin._id, updateData);

        AuditLogger.security('ADMIN_ACCOUNT_LOCKED', { email });

        throw new AppError('Too many failed attempts. Account locked for 15 minutes.', HTTP_STATUS.TOO_MANY_REQUESTS, 'ACCOUNT_LOCKED');

      }



      await AdminRepository.updateById(admin._id, updateData);

      AuditLogger.security('ADMIN_LOGIN_FAILED', { email, attempts });

      throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED, 'INVALID_ADMIN_AUTH');

    }



    // Reset attempts on success

    if (admin.loginAttempts > 0 || admin.lockoutUntil) {

      await AdminRepository.updateById(admin._id, { loginAttempts: 0, lockoutUntil: undefined });

    }



    // Determine refresh token expiration

    // 30 days if rememberMe, 1 day otherwise

    const refreshTokenExpire = rememberMe ? '30d' : '1d';



    const accessToken = generateToken(admin._id, { version: admin.tokenVersion });

    const refreshToken = generateRefreshToken(admin._id, { version: admin.tokenVersion }, refreshTokenExpire);



    AuditLogger.log('ADMIN_LOGIN_SUCCESS', 'ADMIN', { adminId: admin._id, rememberMe });



    return {

      admin: {

        id: admin._id,

        name: admin.name,

        email: admin.email,

        phoneNumber: admin.phoneNumber,

        photo: admin.photo,

      },

      tokens: {

        accessToken,

        refreshToken,

      },

    };

  }



  /**

   * Refresh Token with Proper Rotation

   * Best Practice: Generate new refresh token on each use

   */

  async refreshToken(token) {

    if (!token) {

      throw new AppError('Refresh token is required', HTTP_STATUS.UNAUTHORIZED, 'TOKEN_REQUIRED');

    }



    try {

      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);



      const admin = await AdminRepository.findById(decoded.id, true);

      if (!admin) {

        throw new AppError('Admin not found', HTTP_STATUS.UNAUTHORIZED, 'INVALID_REFRESH_TOKEN');

      }



      // Check for lockout

      if (admin.lockoutUntil && admin.lockoutUntil > Date.now()) {

        throw new AppError('Account is locked', HTTP_STATUS.FORBIDDEN, 'ACCOUNT_LOCKED');

      }



      // Check token version to prevent stolen token reuse

      if (admin.tokenVersion !== decoded.version) {

        throw new AppError('Invalid refresh token version', HTTP_STATUS.UNAUTHORIZED, 'TOKEN_VERSION_MISMATCH');

      }



      // SECURITY: Increment token version to invalidate old refresh tokens

      const newTokenVersion = admin.tokenVersion + 1;

      await AdminRepository.updateById(admin._id, { tokenVersion: newTokenVersion });



      // Generate NEW refresh token with updated version

      const refreshTokenExpire = decoded.exp ? new Date(decoded.exp * 1000) > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) ? '30d' : '1d' : '7d';

      const newRefreshToken = generateRefreshToken(admin._id, { version: newTokenVersion }, refreshTokenExpire);



      // Generate new access token

      const accessToken = generateToken(admin._id, { version: newTokenVersion });



      AuditLogger.security('ADMIN_TOKEN_ROTATED', {

        adminId: admin._id,

        oldVersion: admin.tokenVersion,

        newVersion: newTokenVersion

      });



      return {

        accessToken,

        refreshToken: newRefreshToken,

        tokenVersion: newTokenVersion

      };

    } catch (error) {

      if (error.name === 'TokenExpiredError') {

        AuditLogger.security('ADMIN_REFRESH_TOKEN_EXPIRED', { error: error.message });

        throw new AppError('Refresh token expired. Please login again.', HTTP_STATUS.UNAUTHORIZED, 'TOKEN_EXPIRED');

      }

      if (error.name === 'JsonWebTokenError') {

        AuditLogger.security('ADMIN_INVALID_REFRESH_TOKEN', { error: error.message });

        throw new AppError('Invalid refresh token', HTTP_STATUS.UNAUTHORIZED, 'INVALID_TOKEN');

      }

      throw error;

    }

  }



  /**

   * Update Admin Profile

   */

  async updateProfile(adminId, updateData) {

    const { email } = updateData;



    // If email is being updated, check for duplicates

    if (email) {

      const existingAdmin = await AdminRepository.findByEmail(email);

      if (existingAdmin && existingAdmin._id.toString() !== adminId) {

        throw new AppError('Email already in use by another admin', HTTP_STATUS.CONFLICT, 'EMAIL_EXISTS');

      }

    }



    const updatedAdmin = await AdminRepository.updateById(adminId, updateData);

    if (!updatedAdmin) {

      throw new AppError('Admin not found', HTTP_STATUS.NOT_FOUND, 'ADMIN_NOT_FOUND');

    }



    AuditLogger.log('ADMIN_PROFILE_UPDATED', 'ADMIN', { adminId, updatedFields: Object.keys(updateData) });



    await this.invalidateAdminCache(adminId);



    return {

      id: updatedAdmin._id,

      name: updatedAdmin.name,

      email: updatedAdmin.email,

      phoneNumber: updatedAdmin.phoneNumber,

      photo: updatedAdmin.photo,

    };

  }



  /**

   * Update Admin Photo

   */

  async updatePhoto(adminId, file) {

    const admin = await AdminRepository.findById(adminId);

    if (!admin) {

      throw new AppError('Admin not found', HTTP_STATUS.NOT_FOUND, 'ADMIN_NOT_FOUND');

    }



    // Delete old photo if exists

    if (admin.photo?.publicId) {

      await deleteFromCloudinary(admin.photo.publicId);

    }



    // Upload new photo

    const result = await uploadToCloudinary(file, 'admins/profiles');



    const photoData = {

      url: result.secure_url,

      publicId: result.public_id,

    };



    const updatedAdmin = await AdminRepository.updateById(adminId, { photo: photoData });

    AuditLogger.log('ADMIN_PHOTO_UPDATED', 'ADMIN', { adminId });



    await this.invalidateAdminCache(adminId);



    return updatedAdmin.photo;

  }



  /**

   * Delete Admin Photo

   */

  async deletePhoto(adminId) {

    const admin = await AdminRepository.findById(adminId);

    if (!admin) {

      throw new AppError('Admin not found', HTTP_STATUS.NOT_FOUND, 'ADMIN_NOT_FOUND');

    }



    if (admin.photo?.publicId) {

      await deleteFromCloudinary(admin.photo.publicId);

    }



    await AdminRepository.updateById(adminId, {

      photo: { url: null, publicId: null }

    });



    AuditLogger.log('ADMIN_PHOTO_DELETED', 'ADMIN', { adminId });

    await this.invalidateAdminCache(adminId);

    return true;

  }



  /**

   * Update Admin Password

   */

  async updatePassword(adminId, newPassword) {

    const admin = await AdminRepository.findById(adminId, false, false);

    if (!admin) {

      throw new AppError('Admin not found', HTTP_STATUS.NOT_FOUND, 'ADMIN_NOT_FOUND');

    }



    admin.password = newPassword;

    admin.tokenVersion = (admin.tokenVersion || 0) + 1;

    await admin.save(); // Model pre-save hook will hash it



    AuditLogger.log('ADMIN_PASSWORD_CHANGED', 'ADMIN', { adminId });

    await this.invalidateAdminCache(adminId);

    return true;

  }



  /**

   * Generate and Send OTP for Forgot Password

   */

  async forgotPassword(email) {

    const admin = await AdminRepository.findByEmail(email, false, true);

    if (!admin) {

      // Don't leak exists status, just pretend success or throw generic (Enterprise often says "If account exists...")

      // But for this internal Admin tool, we can be more explicit or just throw generic.

      // Let's throw explicit for this internal tool as requested by user ("admin email daale").

      throw new AppError('Admin with this email not found', HTTP_STATUS.NOT_FOUND, 'ADMIN_NOT_FOUND');

    }



    // Check if account is locked

    if (admin.resetPasswordLockout && admin.resetPasswordLockout > Date.now()) {

      throw new AppError('Account is temporarily locked. Please try again later.', HTTP_STATUS.TOO_MANY_REQUESTS, 'ACCOUNT_LOCKED');

    }



    // Generate 6 digit OTP

    const otp = Math.floor(100000 + Math.random() * 900000).toString();



    // Hash OTP before saving (Security Best Practice)

    const resetPasswordOtp = crypto

      .createHash('sha256')

      .update(otp)

      .digest('hex');



    // Set expiration (1 minute as requested)

    const resetPasswordExpires = Date.now() + 1 * 60 * 1000;



    await AdminRepository.updateById(admin._id, {

      resetPasswordOtp,

      resetPasswordExpires,

      resetPasswordOtpAttempts: 0, // Reset attempts on new OTP

      resetPasswordLockout: undefined,

    });



    // Queue OTP email (Async - no API blocking)
    try {
      await emailQueue.add('send-custom', {
        type: 'send-custom',
        to: admin.email,
        template: 'Password Reset',
        data: {
          username: admin.name,
          otp: otp
        },
        role: 'admin'
      });
      AuditLogger.log('OTP_SENT', 'ADMIN', { adminId: admin._id });
    } catch (err) {
      // Rollback changes if email queue fails
      await AdminRepository.updateById(admin._id, {
        resetPasswordOtp: undefined,
        resetPasswordExpires: undefined,
      });
      throw err;
    }



    return true;

  }



  /**

   * Verify OTP

   * Returns a temporary reset token or just validation success

   */

  async verifyOtp(email, otp) {

    const hashedOtp = crypto

      .createHash('sha256')

      .update(otp)

      .digest('hex');



    const admin = await AdminRepository.findByEmail(email, false, true); // We need to find by email to verify



    if (!admin) {

      throw new AppError('Invalid request', HTTP_STATUS.BAD_REQUEST, 'INVALID_REQUEST');

    }



    // Check Lockout

    if (admin.resetPasswordLockout && admin.resetPasswordLockout > Date.now()) {

      throw new AppError('Account is temporarily locked. Please try again later.', HTTP_STATUS.TOO_MANY_REQUESTS, 'ACCOUNT_LOCKED');

    }



    // Check Expiration

    if (!admin.resetPasswordOtp || !admin.resetPasswordExpires || Date.now() > admin.resetPasswordExpires) {

      throw new AppError('OTP has expired or is invalid', HTTP_STATUS.BAD_REQUEST, 'OTP_EXPIRED');

    }



    // Verify Hash

    if (hashedOtp !== admin.resetPasswordOtp) {

      // Increment attempts

      const attempts = (admin.resetPasswordOtpAttempts || 0) + 1;



      const updateData = { resetPasswordOtpAttempts: attempts };



      // Lock if 3 attempts reached

      if (attempts >= 3) {

        updateData.resetPasswordLockout = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Clear OTP to force resend after lockout (optional, but good practice)

        updateData.resetPasswordOtp = undefined;

        updateData.resetPasswordExpires = undefined;



        await AdminRepository.updateById(admin._id, updateData);

        throw new AppError('Too many invalid attempts. Account locked for 10 minutes.', HTTP_STATUS.TOO_MANY_REQUESTS, 'ACCOUNT_LOCKED');

      }



      await AdminRepository.updateById(admin._id, updateData);

      throw new AppError(`Invalid OTP. You have ${3 - attempts} attempts remaining.`, HTTP_STATUS.BAD_REQUEST, 'INVALID_OTP');

    }



    // OTP is valid

    // For a stateless verified flow, we can return a short-lived "reset token" 

    // OR we can just return success and expect client to send OTP again with password 

    // (User said: "fir otp verify krne ke baad new password daale")

    // Let's return a temporary token to authorize the reset password call.



    // Clear OTP fields immediately to prevent reuse (though token is now key)

    await AdminRepository.updateById(admin._id, {

      resetPasswordOtpAttempts: 0,

      resetPasswordLockout: undefined,

      resetPasswordOtp: undefined,

      resetPasswordExpires: undefined

    });



    // Using a JWT signed with a special secret or just short expiration

    // Using a JWT signed with a special secret or just short expiration

    const resetToken = jwt.sign({ id: admin._id }, env.JWT_SECRET, { expiresIn: '15m' });



    AuditLogger.log('OTP_VERIFIED', 'ADMIN', { adminId: admin._id });

    return { resetToken };

  }



  /**

   * Reset Password using Token

   */

  async resetPassword(resetToken, newPassword) {

    // Verify the reset token

    // In a real flow, verifyOtp returns a token, and resetPassword uses it.

    // We can reuse the same token verification logic or just verify here.



    let decoded;

    try {

      decoded = jwt.verify(resetToken, env.JWT_SECRET);

    } catch (err) {

      throw new AppError('Invalid or expired reset token', HTTP_STATUS.BAD_REQUEST, 'INVALID_TOKEN');

    }



    const admin = await AdminRepository.findById(decoded.id);

    if (!admin) {

      throw new AppError('Admin not found', HTTP_STATUS.NOT_FOUND, 'ADMIN_NOT_FOUND');

    }



    // Ensure we clear the OTP fields to prevent replay

    admin.password = newPassword;

    // OTP fields already cleared in verifyOtp, but ensuring clean state doesn't hurt

    admin.resetPasswordOtp = undefined;

    admin.resetPasswordExpires = undefined;

    admin.resetPasswordOtpAttempts = 0;

    admin.resetPasswordLockout = undefined;



    await admin.save();



    AuditLogger.log('PASSWORD_RESET_SUCCESS', 'ADMIN', { adminId: admin._id });

    return true;

  }



  /**

   * Bootstraps the initial admin user from environment variables if no admin exists.

   */

  async bootstrapAdmin() {

    try {

      const count = await AdminRepository.count();

      if (count === 0) {

        Logger.info('🚀 No admin found, bootstrapping initial admin...');

        await AdminRepository.create({

          name: 'System Admin',

          email: env.ADMIN_EMAIL,

          password: env.ADMIN_PASSWORD, // This will be hashed by the model pre-save hook

        });

        Logger.info('✅ Initial admin bootstrapped successfully.');

      }

    } catch (error) {

      Logger.error('❌ Failed to bootstrap admin:', error);

    }

  }

}



export default new AdminService();

