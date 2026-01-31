import jwt from 'jsonwebtoken';
import EmployeeRepository from '../repositories/employee.repository.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { HTTP_STATUS } from '../constants.js';
import env from '../config/env.js';

/**
 * Protect middleware to authenticate employee via JWT
 */
export const protectEmployee = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new AppError('You are not logged in! Please log in to get access.', HTTP_STATUS.UNAUTHORIZED);
  }

  const decoded = jwt.verify(token, env.JWT_SECRET);

  const employee = await EmployeeRepository.findById(decoded.id);

  if (!employee) {
    throw new AppError('The employee belonging to this token no longer exists.', HTTP_STATUS.UNAUTHORIZED);
  }

  if (!employee.isActive) {
    throw new AppError('This employee account is blocked. Please contact administrator.', HTTP_STATUS.UNAUTHORIZED);
  }

  // Token versioning check for session invalidation
  if (employee.tokenVersion !== decoded.tokenVersion) {
    throw new AppError('Session expired. Please log in again.', HTTP_STATUS.UNAUTHORIZED);
  }

  req.user = employee;
  req.role = 'employee';
  next();
});

/**
 * Unified Staff Authorization
 * Allows either Super Admin OR Employee with specific permission
 * @param {string} permission - The permission required (e.g., SYSTEM_PERMISSIONS.ORDER_MANAGEMENT)
 */
export const authorizeStaff = (permission) => {
  return async (req, res, next) => {
    let token;

    // 1. Get token from header (Standard) or Cookie (Admin)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.adminAccessToken) {
      token = req.cookies.adminAccessToken;
    }

    if (!token) {
      throw new AppError('Authentication required to access this resource.', HTTP_STATUS.UNAUTHORIZED);
    }

    try {
      // 2. Verify token
      const decoded = jwt.verify(token, env.JWT_SECRET);

      // 3. Check for Super Admin
      if (decoded.role === 'admin' || !decoded.role) { 
        // Note: Legacy admin tokens might not have an explicit role field
        const AdminRepository = (await import('../repositories/admin.repository.js')).default;
        const admin = await AdminRepository.findById(decoded.id);
        
        if (admin && decoded.version === admin.tokenVersion) {
          req.admin = admin;
          req.role = 'admin';
          return next();
        }
      }

      // 4. Check for Employee
      const employee = await EmployeeRepository.findById(decoded.id);
      if (employee && employee.isActive && employee.tokenVersion === decoded.tokenVersion) {
        // Strict Authorization: Check if role has the specific module permission
        if (employee.role && employee.role.permissions.includes(permission)) {
          req.user = employee;
          req.role = 'employee';
          return next();
        }
        
        throw new AppError(`Access Forbidden: ${permission} access is required.`, HTTP_STATUS.FORBIDDEN);
      }

      throw new AppError('Unauthorized access or session expired.', HTTP_STATUS.UNAUTHORIZED);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Session expired. Please log in again.', HTTP_STATUS.UNAUTHORIZED);
      }
      throw error;
    }
  };
};

export default {
  protectEmployee,
  authorizeStaff,
};
