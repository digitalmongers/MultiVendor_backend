import EmployeeRepository from '../repositories/employee.repository.js';
import RoleRepository from '../repositories/role.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import { generateToken } from '../utils/jwt.js';
import Logger from '../utils/logger.js';

class EmployeeService {
  async registerEmployee(employeeData, files) {
    const existingEmployee = await EmployeeRepository.findByEmail(employeeData.email);
    if (existingEmployee) {
      throw new AppError('Employee with this email already exists', HTTP_STATUS.BAD_REQUEST);
    }

    const role = await RoleRepository.findById(employeeData.role);
    if (!role) {
      throw new AppError('Invalid Role ID provided', HTTP_STATUS.BAD_REQUEST);
    }

    // Handle Image Uploads (Profile, Identity Front/Back)
    if (files) {
      if (files.profileImage) {
        const result = await uploadToCloudinary(files.profileImage[0], 'employees/profiles');
        employeeData.profileImage = { url: result.secure_url, publicId: result.public_id };
      }
      
      employeeData.identityImage = {};
      if (files.identityFront) {
        const result = await uploadToCloudinary(files.identityFront[0], 'employees/identity');
        employeeData.identityImage.front = { url: result.secure_url, publicId: result.public_id };
      }
      if (files.identityBack) {
        const result = await uploadToCloudinary(files.identityBack[0], 'employees/identity');
        employeeData.identityImage.back = { url: result.secure_url, publicId: result.public_id };
      }
    }

    const employee = await EmployeeRepository.create(employeeData);
    Logger.info(`New employee registered: ${employee.email} with role: ${role.name}`);
    return employee;
  }

  async login(email, password) {
    const employee = await EmployeeRepository.findByEmail(email, true);
    if (!employee || !employee.isActive || !(await employee.comparePassword(password, employee.password))) {
      throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
    }

    const token = generateToken(employee._id, {
      role: 'employee',
      permissions: employee.role.permissions,
      tokenVersion: employee.tokenVersion
    });

    employee.lastLogin = new Date();
    await employee.save();

    return { employee, token };
  }

  async getAllEmployees(query, page, limit) {
    const skip = (page - 1) * limit;
    const employees = await EmployeeRepository.findAll(query, skip, limit);
    const total = await EmployeeRepository.count(query);
    return { employees, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getEmployeeStats() {
    const totalEmployees = await EmployeeRepository.count();
    const activeEmployees = await EmployeeRepository.count({ isActive: true });
    const inactiveEmployees = await EmployeeRepository.count({ isActive: false });
    const totalRoles = await RoleRepository.count();

    return {
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      totalRoles
    };
  }

  async updateEmployeeStatus(id, isActive) {
    const updateData = { isActive };
    
    // If blocking, increment tokenVersion to invalidate existing sessions
    if (isActive === false) {
      updateData.$inc = { tokenVersion: 1 };
    }

    const employee = await EmployeeRepository.updateById(id, updateData);
    if (!employee) {
      throw new AppError('Employee not found', HTTP_STATUS.NOT_FOUND);
    }
    
    Logger.info(`Employee ${employee.email} status updated to: ${isActive ? 'Active' : 'Blocked'}`);
    return employee;
  }

  async deleteEmployee(id) {
    const employee = await EmployeeRepository.deleteById(id);
    if (!employee) {
      throw new AppError('Employee not found', HTTP_STATUS.NOT_FOUND);
    }
    return employee;
  }
}

export default new EmployeeService();
