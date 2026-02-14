import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required'],
    },
    ticketId: {
      type: String,
      unique: true,
      required: [true, 'Ticket ID is required'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    attachment: {
      url: String,
      publicId: String,
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved'],
      default: 'Open',
    },
    adminReply: {
      type: String,
    },
    replyDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

// ========================================
// PERFORMANCE OPTIMIZATION: Database Indexes
// ========================================

// Note: ticketId index is already created by { unique: true } in schema definition

// Index for customer ticket lookups (most common query)
supportTicketSchema.index({ customer: 1, createdAt: -1 });

// Index for status filtering (admin dashboard)
supportTicketSchema.index({ status: 1, createdAt: -1 });

// Index for priority-based sorting
supportTicketSchema.index({ priority: 1, createdAt: -1 });

// Compound index for admin dashboard filters
supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });

// Index for subject search
supportTicketSchema.index({ subject: 'text', description: 'text' });

// Pre-save hook to generate Ticket ID (e.g., TK1001)
supportTicketSchema.pre('validate', async function (next) {
  if (this.isNew && !this.ticketId) {
    const lastTicket = await mongoose.model('SupportTicket').findOne({}, {}, { sort: { createdAt: -1 } });
    let lastId = 1000;
    if (lastTicket && lastTicket.ticketId) {
      const match = lastTicket.ticketId.match(/\d+/);
      if (match) lastId = parseInt(match[0]);
    }
    this.ticketId = `TK${lastId + 1}`;
  }
  next();
});

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

export default SupportTicket;
