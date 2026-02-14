import PaymentGateway from '../models/paymentGateway.model.js';

class PaymentGatewayRepository {
  async findByName(name) {
    return await PaymentGateway.findOne({ name }).populate('updatedBy', 'name email').lean();
  }

  async getAll() {
    return await PaymentGateway.find().sort({ createdAt: 1 }).populate('updatedBy', 'name email').lean();
  }

  async getActive() {
    return await PaymentGateway.find({ isActive: true }).lean();
  }

  async update(name, updateData) {
    return await PaymentGateway.findOneAndUpdate(
      { name },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    ).populate('updatedBy', 'name email').lean();
  }

  async findById(id) {
    return await PaymentGateway.findById(id).lean();
  }
}

export default new PaymentGatewayRepository();
