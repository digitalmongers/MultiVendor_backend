import SupportTicket from '../models/supportTicket.model.js';

class SupportTicketRepository {
  async create(ticketData) {
    return await SupportTicket.create(ticketData);
  }

  async findByCustomer(customerId) {
    return await SupportTicket.find({ customer: customerId }).sort({ createdAt: -1 }).lean();
  }

  async findAll(query = {}) {
    return await SupportTicket.find(query)
      .populate('customer', 'name email phoneNumber')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findById(id) {
    return await SupportTicket.findById(id).populate('customer', 'name email phoneNumber').lean();
  }

  async updateById(id, updateData) {
    return await SupportTicket.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('customer', 'name email phoneNumber');
  }

  async countByStatus(status) {
    return await SupportTicket.countDocuments({ status });
  }
}

export default new SupportTicketRepository();
