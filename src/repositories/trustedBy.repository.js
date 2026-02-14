import TrustedBy from '../models/trustedBy.model.js';

class TrustedByRepository {
  async create(data) {
    return await TrustedBy.create(data);
  }

  async findById(id) {
    return await TrustedBy.findById(id).lean();
  }

  async findAll(filter = {}, sort = { createdAt: -1 }) {
    return await TrustedBy.find(filter).sort(sort).lean();
  }

  async update(id, data) {
    return await TrustedBy.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
  }

  async delete(id) {
    return await TrustedBy.findByIdAndDelete(id);
  }

  async updateStatus(id, status) {
    return await TrustedBy.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
  }
}

export default new TrustedByRepository();
