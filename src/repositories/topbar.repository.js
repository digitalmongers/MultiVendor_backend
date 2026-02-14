import Topbar from '../models/topbar.model.js';

class TopbarRepository {
  /**
   * We only ever want one Topbar record.
   * This method finds the first one and updates it, or creates it if none exist.
   */
  async upsertTopbar(data) {
    return await Topbar.findOneAndUpdate({}, data, {
      new: true,
      upsert: true,
      runValidators: true,
    });
  }

  async getTopbar() {
    return await Topbar.findOne().lean();
  }
}

export default new TopbarRepository();
