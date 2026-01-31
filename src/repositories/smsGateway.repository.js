import SmsGateway from '../models/smsGateway.model.js';

class SmsGatewayRepository {
  async getAll() {
    return await SmsGateway.find().sort({ createdAt: 1 }).populate('updatedBy', 'name email').lean();
  }

  async findByName(name) {
    return await SmsGateway.findOne({ name }).populate('updatedBy', 'name email').lean();
  }

  async getActive() {
    return await SmsGateway.find({ isActive: true }).lean();
  }

  async update(name, updateData) {
    return await SmsGateway.findOneAndUpdate(
      { name },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    ).populate('updatedBy', 'name email').lean();
  }
}

export default new SmsGatewayRepository();
