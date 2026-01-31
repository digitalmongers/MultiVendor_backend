import Employee from '../models/employee.model.js';

class EmployeeRepository {
  async create(employeeData) {
    return await Employee.create(employeeData);
  }

  async findByEmail(email, selectPassword = false) {
    const query = Employee.findOne({ email }).populate('role');
    if (selectPassword) {
      query.select('+password');
    }
    return await query;
  }

  async findById(id) {
    return await Employee.findById(id).populate('role');
  }

  async findAll(query = {}, skip = 0, limit = 10) {
    return await Employee.find(query)
      .populate('role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async updateById(id, updateData) {
    return await Employee.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).populate('role');
  }

  async deleteById(id) {
    return await Employee.findByIdAndDelete(id);
  }

  async count(query = {}) {
    return await Employee.countDocuments(query);
  }
}

export default new EmployeeRepository();
