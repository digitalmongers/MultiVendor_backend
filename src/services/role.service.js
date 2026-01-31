import RoleRepository from '../repositories/role.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';

class RoleService {
  async createRole(roleData) {
    const existingRole = await RoleRepository.findByName(roleData.name);
    if (existingRole) {
      throw new AppError('Role with this name already exists', HTTP_STATUS.BAD_REQUEST);
    }
    return await RoleRepository.create(roleData);
  }

  async getAllRoles() {
    return await RoleRepository.findAll();
  }

  async updateRole(id, updateData) {
    const role = await RoleRepository.updateById(id, updateData);
    if (!role) {
      throw new AppError('Role not found', HTTP_STATUS.NOT_FOUND);
    }
    return role;
  }

  async deleteRole(id) {
    const role = await RoleRepository.findById(id);
    if (!role) {
      throw new AppError('Role not found', HTTP_STATUS.NOT_FOUND);
    }
    // TODO: Check if any employees are assigned to this role before deleting
    return await RoleRepository.deleteById(id);
  }

  async getRoleById(id) {
    const role = await RoleRepository.findById(id);
    if (!role) {
      throw new AppError('Role not found', HTTP_STATUS.NOT_FOUND);
    }
    return role;
  }
}

export default new RoleService();
