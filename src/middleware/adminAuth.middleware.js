import jwt from 'jsonwebtoken';
import AdminRepository from '../repositories/admin.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../constants.js';
import env from '../config/env.js';

/**
 * Middleware to protect admin routes.
 * Ensures the requester is authenticated as an Admin.
 */
export const adminProtect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.adminAccessToken) {
    token = req.cookies.adminAccessToken;
  }

  if (!token) {
    throw new AppError('Admin authentication required', HTTP_STATUS.UNAUTHORIZED, 'ADMIN_UNAUTHORIZED');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    const admin = await AdminRepository.findById(decoded.id);
    if (!admin) {
      throw new AppError('Admin not found or unauthorized', HTTP_STATUS.UNAUTHORIZED, 'ADMIN_NOT_FOUND');
    }

    // Token Versioning Check (Production Security Pattern)
    if (decoded.version !== admin.tokenVersion) {
      throw new AppError('Session expired or revoked. Please login again.', HTTP_STATUS.UNAUTHORIZED, 'ADMIN_SESSION_REVOKED');
    }

    // Attach admin info to request
    req.admin = admin;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Admin session expired', HTTP_STATUS.UNAUTHORIZED, 'ADMIN_TOKEN_EXPIRED');
    }
    throw new AppError('Invalid admin token', HTTP_STATUS.UNAUTHORIZED, 'ADMIN_INVALID_TOKEN');
  }
};
