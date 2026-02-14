import FAQ from '../models/faq.model.js';

class FAQRepository {
  async create(data) {
    return await FAQ.create(data);
  }

  async findById(id) {
    return await FAQ.findById(id).lean();
  }

  async findAll(filter = {}) {
    return await FAQ.find(filter).sort({ createdAt: -1 }).lean();
  }

  async update(id, data) {
    return await FAQ.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
  }

  async delete(id) {
    return await FAQ.findByIdAndDelete(id);
  }
}

export default new FAQRepository();
