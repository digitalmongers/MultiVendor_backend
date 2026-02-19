import Customer from '../models/customer.model.js';
import Logger from '../utils/logger.js';

class CustomerRepository {
  async create(customerData, options = {}) {
    Logger.debug('DB: Creating customer(s)', { customerData });
    const docs = await Customer.create(Array.isArray(customerData) ? customerData : [customerData], options);
    return Array.isArray(customerData) ? docs : docs[0];
  }

  async findByEmail(email, selectFields = '', lean = false) {
    Logger.debug(`DB: Finding customer by email: ${email}`);
    const query = Customer.findOne({ email });
    if (selectFields) {
      query.select(selectFields);
    }
    if (lean) {
      query.lean();
    }
    return await query;
  }

  async findById(id, selectFields = '', lean = false) {
    Logger.debug(`DB: Finding customer by ID: ${id}`);
    const query = Customer.findById(id);
    if (selectFields) {
      query.select(selectFields);
    }
    if (lean) {
      query.lean();
    }
    return await query;
  }

  async updateById(id, updateData, options = { returnDocument: 'after' }) {
    Logger.debug(`DB: Updating customer by ID: ${id}`, { updateData });
    return await Customer.findByIdAndUpdate(id, updateData, options);
  }

  async findOne(filter, selectFields = '', lean = false) {
    Logger.debug('DB: Finding customer with filter', { filter });
    const query = Customer.findOne(filter);
    if (selectFields) {
      query.select(selectFields);
    }
    if (lean) {
      query.lean();
    }
    return await query;
  }
}

export default new CustomerRepository();
