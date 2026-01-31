import RoleService from '../services/role.service.js';
import catchAsync from '../utils/catchAsync.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';

/**
 * @desc    Create a new role
 * @route   POST /api/v1/admin/roles
 * @access  Private (Admin)
 */
export const createRole = catchAsync(async (req, res) => {
  const role = await RoleService.createRole(req.body);
  res.status(HTTP_STATUS.CREATED).json(new ApiResponse(HTTP_STATUS.CREATED, role, 'Role created successfully'));
});

/**
 * @desc    Get all roles
 * @route   GET /api/v1/admin/roles
 * @access  Private (Admin)
 */
export const getAllRoles = catchAsync(async (req, res) => {
  const roles = await RoleService.getAllRoles();
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, roles));
});

/**
 * @desc    Update a role
 * @route   PATCH /api/v1/admin/roles/:id
 * @access  Private (Admin)
 */
export const updateRole = catchAsync(async (req, res) => {
  const role = await RoleService.updateRole(req.params.id, req.body);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, role, 'Role updated successfully'));
});

/**
 * @desc    Delete a role
 * @route   DELETE /api/v1/admin/roles/:id
 * @access  Private (Admin)
 */
export const deleteRole = catchAsync(async (req, res) => {
  await RoleService.deleteRole(req.params.id);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, 'Role deleted successfully'));
});

export default {
  createRole,
  getAllRoles,
  updateRole,
  deleteRole,
};
