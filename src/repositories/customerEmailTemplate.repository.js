import CustomerEmailTemplate from '../models/customerEmailTemplate.model.js';

class CustomerEmailTemplateRepository {
  async findByEvent(event) {
    return await CustomerEmailTemplate.findOne({ event }).lean();
  }

  async getAll() {
    return await CustomerEmailTemplate.find({}).sort({ event: 1 }).lean();
  }

  async updateByEvent(event, updateData) {
    return await CustomerEmailTemplate.findOneAndUpdate(
      { event },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );
  }

  async findById(id) {
    return await CustomerEmailTemplate.findById(id).lean();
  }

  async updateById(id, updateData) {
    return await CustomerEmailTemplate.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }
}

export default new CustomerEmailTemplateRepository();
