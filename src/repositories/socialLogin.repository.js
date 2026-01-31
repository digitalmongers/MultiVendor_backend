import SocialLogin from '../models/socialLogin.model.js';

class SocialLoginRepository {
  async getAll() {
    return await SocialLogin.find().sort({ createdAt: 1 }).populate('updatedBy', 'name email').lean();
  }

  async getActive() {
    return await SocialLogin.find({ isActive: true }).lean();
  }

  async findByProvider(provider) {
    return await SocialLogin.findOne({ provider }).populate('updatedBy', 'name email').lean();
  }

  async update(provider, updateData) {
    return await SocialLogin.findOneAndUpdate(
      { provider },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    ).populate('updatedBy', 'name email').lean();
  }
}

export default new SocialLoginRepository();
