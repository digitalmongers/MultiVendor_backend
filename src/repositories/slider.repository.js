import Slider from '../models/slider.model.js';

class SliderRepository {
  async create(data) {
    return await Slider.create(data);
  }

  async findById(id) {
    return await Slider.findById(id).lean();
  }

  async findAll(filter = {}, sort = { createdAt: -1 }) {
    return await Slider.find(filter).sort(sort).lean();
  }

  async update(id, data) {
    return await Slider.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
  }

  async delete(id) {
    return await Slider.findByIdAndDelete(id);
  }

  async updateStatus(id, published) {
    return await Slider.findByIdAndUpdate(
      id,
      { published },
      { new: true }
    );
  }
}

export default new SliderRepository();
