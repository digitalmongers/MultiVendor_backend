import Role from '../models/role.model.js';

class RoleRepository {
  async create(roleData) {
    return await Role.create(roleData);
  }

  async findByName(name) {
    return await Role.findOne({ name }).lean();
  }

  async findById(id) {
    return await Role.findById(id).lean();
  }

  async findAll(query = {}) {
    return await Role.find(query).sort({ createdAt: -1 }).lean();
  }

  async updateById(id, updateData) {
    return await Role.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  }

  async deleteById(id) {
    return await Role.findByIdAndDelete(id);
  }

  async count(query = {}) {
    return await Role.countDocuments(query);
  }
}

export default new RoleRepository();
