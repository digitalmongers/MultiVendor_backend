import SupportTicketRepository from '../repositories/supportTicket.repository.js';
import EmailService from './email.service.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import Cache from '../utils/cache.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Logger from '../utils/logger.js';

class SupportTicketService {
  async submitTicket(customerId, ticketData, file) {
    let attachment = {};
    if (file) {
      const result = await uploadToCloudinary(file, 'support-tickets/attachments');
      attachment = {
        url: result.secure_url,
        publicId: result.public_id,
      };
    }

    const ticket = await SupportTicketRepository.create({
      customer: customerId,
      ...ticketData,
      attachment,
    });

    // Invalidate Caches
    await Cache.delByPattern(`response:customer:${customerId}:*support-tickets*`);
    await Cache.delByPattern(`response:admin:*support-tickets*`);

    Logger.info(`Support ticket submitted: ${ticket.ticketId} by Customer: ${customerId}`);
    return ticket;
  }

  async getCustomerTickets(customerId) {
    return await SupportTicketRepository.findByCustomer(customerId);
  }

  async getAllTickets(query) {
    return await SupportTicketRepository.findAll(query);
  }

  async getDetailedStats() {
    const total = await SupportTicketRepository.findAll({});
    const openCount = await SupportTicketRepository.countByStatus('Open');
    const inProgressCount = await SupportTicketRepository.countByStatus('In Progress');
    const resolvedCount = await SupportTicketRepository.countByStatus('Resolved');

    const totalCount = total.length;

    // Helper to calculate percentage and trend
    const getPercentage = (count) => (totalCount > 0 ? ((count / totalCount) * 100).toFixed(0) : 0);

    return {
      total: {
        count: totalCount,
        label: 'Total Tickets',
        trend: '+12% from last month', // Static for now as requested by UI mockup
        icon: 'support_agent'
      },
      open: {
        count: openCount,
        label: 'Open Tickets',
        percentage: getPercentage(openCount),
        icon: 'schedule'
      },
      inProgress: {
        count: inProgressCount,
        label: 'In Progress',
        percentage: getPercentage(inProgressCount),
        icon: 'report_problem'
      },
      resolved: {
        count: resolvedCount,
        label: 'Resolved',
        percentage: getPercentage(resolvedCount),
        icon: 'check_circle'
      }
    };
  }

  async getTicketsForExport() {
    return await SupportTicketRepository.findAll({});
  }

  async replyToTicket(ticketId, adminReply) {
    const ticket = await SupportTicketRepository.updateById(ticketId, {
      adminReply,
      status: 'Resolved',
      replyDate: new Date(),
    });

    if (!ticket) {
      throw new AppError('Ticket not found', HTTP_STATUS.NOT_FOUND);
    }

    // Send email to customer
    try {
      await EmailService.sendEmailTemplate(
        ticket.customer.email,
        'Support Ticket Reply',
        {
          username: ticket.customer.name,
          ticketId: ticket.ticketId,
          subject: ticket.subject,
          reply: adminReply,
        },
        'customer'
      );
      Logger.info(`Support ticket reply email sent to: ${ticket.customer.email}`);
    } catch (error) {
      Logger.error(`Failed to send support ticket reply email`, { ticketId, error: error.message });
    }

    // Invalidate Caches
    await Cache.delByPattern(`response:customer:${ticket.customer._id}:*support-tickets*`);
    await Cache.delByPattern(`response:admin:*support-tickets*`);

    return ticket;
  }
}

export default new SupportTicketService();
