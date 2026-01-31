import EmployeeService from '../services/employee.service.js';
import catchAsync from '../utils/catchAsync.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';
import { jsonToCsv } from '../utils/csvGenerator.js';

/**
 * @desc    Register a new employee
 * @route   POST /api/v1/admin/employees
 * @access  Private (Admin)
 */
export const registerEmployee = catchAsync(async (req, res) => {
  const employee = await EmployeeService.registerEmployee(req.body, req.files);
  res.status(HTTP_STATUS.CREATED).json(new ApiResponse(HTTP_STATUS.CREATED, employee, 'Employee registered successfully'));
});

/**
 * @desc    Employee Login
 * @route   POST /api/v1/employee/auth/login
 * @access  Public
 */
export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await EmployeeService.login(email, password);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Login successful'));
});

/**
 * @desc    Get all employees with pagination and filter
 * @route   GET /api/v1/admin/employees
 * @access  Private (Admin)
 */
export const getAllEmployees = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, search, status, role } = req.query;
  const query = {};
  if (search) query.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
  if (status) query.isActive = status === 'active';
  if (role) query.role = role;

  const result = await EmployeeService.getAllEmployees(query, Number(page), Number(limit));
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result));
});

/**
 * @desc    Get Employee Statistics
 * @route   GET /api/v1/admin/employees/stats
 * @access  Private (Admin)
 */
export const getStats = catchAsync(async (req, res) => {
  const stats = await EmployeeService.getEmployeeStats();
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, stats));
});

/**
 * @desc    Update employee status (Block/Unblock)
 * @route   PATCH /api/v1/admin/employees/:id/status
 * @access  Private (Admin)
 */
export const toggleStatus = catchAsync(async (req, res) => {
  const { isActive } = req.body;
  const employee = await EmployeeService.updateEmployeeStatus(req.params.id, isActive);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, employee, `Employee ${isActive ? 'unblocked' : 'blocked'} successfully`));
});

/**
 * @desc    Export Employees to CSV
 * @route   GET /api/v1/admin/employees/export
 * @access  Private (Admin)
 */
export const exportEmployees = catchAsync(async (req, res) => {
  const { employees } = await EmployeeService.getAllEmployees({}, 1, 1000);
  
  const headers = ['ID', 'Name', 'Email', 'Phone', 'Role', 'Status', 'Last Login'];
  const fields = ['_id', 'name', 'email', 'phoneNumber', 'role.name', 'isActive', 'lastLogin'];
  
  const csv = jsonToCsv(employees, headers, fields);
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=employees.csv');
  res.status(200).send(csv);
});

/**
 * @desc    Delete employee
 * @route   DELETE /api/v1/admin/employees/:id
 * @access  Private (Admin)
 */
export const deleteEmployee = catchAsync(async (req, res) => {
  await EmployeeService.deleteEmployee(req.params.id);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, 'Employee deleted successfully'));
});

export default {
  registerEmployee,
  login,
  getAllEmployees,
  getStats,
  toggleStatus,
  exportEmployees,
  deleteEmployee,
};
