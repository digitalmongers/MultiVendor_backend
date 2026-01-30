import SupplierEmailTemplate from '../models/supplierEmailTemplate.model.js';

class SupplierEmailTemplateRepository {
  async findByEvent(event) {
    return await SupplierEmailTemplate.findOne({ event }).lean();
  }

  async getAll() {
    return await SupplierEmailTemplate.find({}).sort({ event: 1 }).lean();
  }

  async updateByEvent(event, updateData) {
    return await SupplierEmailTemplate.findOneAndUpdate(
      { event },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );
  }

  async findById(id) {
    return await SupplierEmailTemplate.findById(id);
  }

  async updateById(id, updateData) {
    return await SupplierEmailTemplate.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }
}

export default new SupplierEmailTemplateRepository();
