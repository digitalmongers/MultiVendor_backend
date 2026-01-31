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
