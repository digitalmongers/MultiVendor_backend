import jwt from 'jsonwebtoken';
import VendorRepository from '../repositories/vendor.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS, ERROR_MESSAGES, VENDOR_STATUS } from '../constants.js';
import RequestContext from '../utils/context.js';
import env from '../config/env.js';
import Logger from '../utils/logger.js';

/**
 * Protect vendor routes - Only authenticated and active vendors allowed
 */
export const protectVendor = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    Logger.warn('Access denied: No token provided');
    throw new AppError(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    const vendor = await VendorRepository.findById(decoded.id);
    if (!vendor) {
      Logger.warn(`Access denied: Vendor ${decoded.id} not found in DB`);
      throw new AppError(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED');
    }

    // Token Versioning Check
    if (decoded.version !== vendor.tokenVersion) {
      Logger.security('SESSION_REVOKED', { 
        vendorId: vendor._id, 
        tokenVersion: decoded.version, 
        dbVersion: vendor.tokenVersion,
        reason: 'Token version mismatch'
      });
      throw new AppError('Session expired. Please login again.', HTTP_STATUS.UNAUTHORIZED, 'SESSION_REVOKED');
    }

    // Status Check
    if (vendor.status !== VENDOR_STATUS.ACTIVE) {
      Logger.warn(`Access denied: Vendor ${vendor._id} status is ${vendor.status}`);
      let message = 'Your account is not active.';
      if (vendor.status === VENDOR_STATUS.PENDING) message = 'Your account is pending admin approval.';
      if (vendor.status === VENDOR_STATUS.REJECTED) message = 'Your account has been rejected.';
      
      throw new AppError(message, HTTP_STATUS.FORBIDDEN, 'ACCOUNT_NOT_ACTIVE');
    }

    // Populate context with vendor info
    RequestContext.set('userId', vendor._id.toString());
    RequestContext.set('vendor', vendor);

    req.user = vendor;
    req.vendor = vendor;
    
    Logger.debug(`Authenticated request for vendor: ${vendor._id}`);
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    Logger.error('JWT Verification Error', { error: err.message, stack: err.stack });
    throw new AppError(ERROR_MESSAGES.INVALID_TOKEN, HTTP_STATUS.UNAUTHORIZED, 'INVALID_TOKEN');
  }
};
