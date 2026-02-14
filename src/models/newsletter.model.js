import mongoose from 'mongoose';

const newsletterSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['subscribed', 'unsubscribed'],
      default: 'subscribed',
    },
  },
  { timestamps: true }
);

// ========================================
// PERFORMANCE OPTIMIZATION: Database Indexes
// ========================================

// Note: email index is already created by { unique: true } in schema definition

// Index for status filtering (active subscribers)
newsletterSchema.index({ status: 1 });

// Compound index for subscribed users by signup date
newsletterSchema.index({ status: 1, createdAt: -1 });

const Newsletter = mongoose.model('Newsletter', newsletterSchema);

export default Newsletter;
