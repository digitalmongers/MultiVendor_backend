import Vendor from '../models/vendor.model.js';
import Logger from '../utils/logger.js';

class VendorRepository {
  async create(vendorData, options = {}) {
    Logger.debug('DB: Creating vendor(s)', { vendorData });
    const docs = await Vendor.create(Array.isArray(vendorData) ? vendorData : [vendorData], options);
    return Array.isArray(vendorData) ? docs : docs[0];
  }

  async findByEmail(email, selectFields = '', lean = false) {
    Logger.debug(`DB: Finding vendor by email: ${email}`);
    const query = Vendor.findOne({ email });
    if (selectFields) {
      query.select(selectFields);
    }
    if (lean) {
      query.lean();
    }
    return await query;
  }

  async findById(id, selectFields = '', lean = false) {
    Logger.debug(`DB: Finding vendor by ID: ${id}`);
    const query = Vendor.findById(id);
    if (selectFields) {
      query.select(selectFields);
    }
    if (lean) {
      query.lean();
    }
    return await query;
  }

  async updateById(id, updateData, options = { returnDocument: 'after' }) {
    Logger.debug(`DB: Updating vendor by ID: ${id}`, { updateData });
    return await Vendor.findByIdAndUpdate(id, updateData, options);
  }

  async findOne(filter, selectFields = '', lean = false) {
    Logger.debug('DB: Finding vendor with filter', { filter });
    const query = Vendor.findOne(filter);
    if (selectFields) {
      query.select(selectFields);
    }
    if (lean) {
      query.lean();
    }
    return await query;
  }

  async updateOne(filter, updateData, options = { new: true }) {
    Logger.debug('DB: Updating vendor with filter', { filter, updateData });
    return await Vendor.findOneAndUpdate(filter, updateData, options);
  }

  async deleteById(id) {
    Logger.debug(`DB: Deleting vendor by ID: ${id}`);
    return await Vendor.findByIdAndDelete(id);
  }
}

export default new VendorRepository();
