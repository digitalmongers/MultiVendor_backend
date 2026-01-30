import jwt from 'jsonwebtoken';
import CustomerRepository from '../repositories/customer.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../constants.js';
import RequestContext from '../utils/context.js';
import env from '../config/env.js';
import Logger from '../utils/logger.js';

/**
 * Protect customer routes - Only authenticated and verified customers allowed
 */
export const protectCustomer = async (req, res, next) => {
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

    const customer = await CustomerRepository.findById(decoded.id);
    if (!customer) {
      Logger.warn(`Access denied: Customer ${decoded.id} not found in DB`);
      throw new AppError(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED');
    }

    // Advanced: Token Versioning Check (Instant Revocation)
    if (decoded.version !== customer.tokenVersion) {
      Logger.security('SESSION_REVOKED', { 
        customerId: customer._id, 
        tokenVersion: decoded.version, 
        dbVersion: customer.tokenVersion,
        reason: 'Token version mismatch (User logged out or reset password)'
      });
      throw new AppError('Session expired. Please login again.', HTTP_STATUS.UNAUTHORIZED, 'SESSION_REVOKED');
    }

    // Check if token was issued before the last password reset
    if (customer.lastPasswordReset) {
      const resetTime = parseInt(customer.lastPasswordReset.getTime() / 1000, 10);
      if (decoded.iat < resetTime) {
        Logger.security('SESSION_REVOKED', { 
          customerId: customer._id, 
          iat: decoded.iat, 
          resetTime,
          reason: 'Token issued before last password reset'
        });
        throw new AppError('Password was recently changed. Please login again.', HTTP_STATUS.UNAUTHORIZED, 'TOKEN_EXPIRED');
      }
    }

    if (!customer.isVerified) {
      Logger.warn(`Access denied: Account ${customer._id} is not verified`);
      throw new AppError('Please verify your email to access this resource', HTTP_STATUS.FORBIDDEN, 'EMAIL_NOT_VERIFIED');
    }

    if (!customer.isActive) {
      Logger.warn(`Access denied: Account ${customer._id} is deactivated`);
      throw new AppError('Your account has been deactivated', HTTP_STATUS.FORBIDDEN, 'ACCOUNT_DEACTIVATED');
    }

    // Populate context with customer info
    RequestContext.set('userId', customer._id.toString());
    RequestContext.set('customer', customer);

    req.user = customer; // Compatibility with common middleware
    req.customer = customer;
    
    Logger.debug(`Authenticated request for customer: ${customer._id}`);
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    Logger.error('JWT Verification Error', { error: err.message, stack: err.stack });
    throw new AppError(ERROR_MESSAGES.INVALID_TOKEN, HTTP_STATUS.UNAUTHORIZED, 'INVALID_TOKEN');
  }
};
