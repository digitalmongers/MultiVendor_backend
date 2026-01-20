import Reliability from '../models/reliability.model.js';

class ReliabilityRepository {
  async upsertByKey(key, data) {
    return await Reliability.findOneAndUpdate({ key }, { ...data, key }, {
      new: true,
      upsert: true,
      runValidators: true,
    });
  }

  async findByKey(key) {
    return await Reliability.findOne({ key });
  }

  async findAll(filter = {}) {
    return await Reliability.find(filter);
  }

  async updateStatus(key, status) {
    return await Reliability.findOneAndUpdate(
      { key },
      { status },
      { new: true }
    );
  }
}

export default new ReliabilityRepository();
