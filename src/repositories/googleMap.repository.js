import GoogleMap from '../models/googleMap.model.js';

class GoogleMapRepository {
  async getSettings() {
    let settings = await GoogleMap.findOne().populate('updatedBy', 'name email').lean();
    if (!settings) {
      settings = await GoogleMap.create({});
    }
    return settings;
  }

  async updateSettings(updateData) {
    return await GoogleMap.findOneAndUpdate(
      {},
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    ).populate('updatedBy', 'name email').lean();
  }
}

export default new GoogleMapRepository();
