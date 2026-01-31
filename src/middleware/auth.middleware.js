import jwt from 'jsonwebtoken';
import AdminRepository from '../repositories/admin.repository.js';
import VendorRepository from '../repositories/vendor.repository.js';
import CustomerRepository from '../repositories/customer.repository.js';
import EmployeeRepository from '../repositories/employee.repository.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { HTTP_STATUS } from '../constants.js';
import env from '../config/env.js';

/**
 * Middleware to allow any authenticated user (Admin, Staff, Vendor, or Customer)
 * Used for universal utilities like file uploads.
 */
export const protectAll = catchAsync(async (req, res, next) => {
  let token;

  // 1. Get token from header or cookies
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.adminAccessToken) {
    token = req.cookies.adminAccessToken;
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    throw new AppError('Authentication required to access this resource.', HTTP_STATUS.UNAUTHORIZED);
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // 2. Try to find user in different collections
    
    // Check Admin/Employee
    if (decoded.role === 'admin' || !decoded.role) {
      const admin = await AdminRepository.findById(decoded.id);
      if (admin && decoded.version === admin.tokenVersion) {
        req.user = admin;
        req.role = 'admin';
        return next();
      }
    }

    // Check Employee
    const employee = await EmployeeRepository.findById(decoded.id);
    if (employee && employee.isActive && employee.tokenVersion === decoded.tokenVersion) {
      req.user = employee;
      req.role = 'employee';
      return next();
    }

    // Check Vendor
    const vendor = await VendorRepository.findById(decoded.id);
    if (vendor && vendor.tokenVersion === decoded.version) {
      req.user = vendor;
      req.role = 'vendor';
      return next();
    }

    // Check Customer
    const customer = await CustomerRepository.findById(decoded.id);
    if (customer && customer.tokenVersion === decoded.version) {
      req.user = customer;
      req.role = 'customer';
      return next();
    }

    throw new AppError('Unauthorized access or session expired.', HTTP_STATUS.UNAUTHORIZED);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Session expired. Please log in again.', HTTP_STATUS.UNAUTHORIZED);
    }
    throw error;
  }
});
