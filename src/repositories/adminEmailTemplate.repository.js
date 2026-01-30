import AdminEmailTemplate from '../models/adminEmailTemplate.model.js';

class AdminEmailTemplateRepository {
  async findByEvent(event) {
    return await AdminEmailTemplate.findOne({ event }).lean();
  }

  async getAll() {
    return await AdminEmailTemplate.find({}).sort({ event: 1 }).lean();
  }

  async updateByEvent(event, updateData) {
    return await AdminEmailTemplate.findOneAndUpdate(
      { event },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );
  }

  async findById(id) {
    return await AdminEmailTemplate.findById(id);
  }

  async updateById(id, updateData) {
    return await AdminEmailTemplate.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }
}

export default new AdminEmailTemplateRepository();
