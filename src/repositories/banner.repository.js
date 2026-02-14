import Banner from '../models/banner.model.js';

class BannerRepository {
  async create(data) {
    return await Banner.create(data);
  }

  async findById(id) {
    return await Banner.findById(id).lean();
  }

  async findAll(filter = {}, sort = { createdAt: -1 }) {
    return await Banner.find(filter).sort(sort).lean();
  }

  async update(id, data) {
    return await Banner.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
  }

  async delete(id) {
    return await Banner.findByIdAndDelete(id);
  }

  async updateStatus(id, published) {
    return await Banner.findByIdAndUpdate(
      id,
      { published },
      { new: true }
    );
  }
}

export default new BannerRepository();
