import mongoose from 'mongoose';

const topbarSchema = new mongoose.Schema(
  {
    bgColor: {
      type: String,
      required: true,
      trim: true,
    },
    textColor: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// ========================================
// PERFORMANCE OPTIMIZATION: Database Indexes
// ========================================

// Index for active topbar lookups
topbarSchema.index({ status: 1 });

const Topbar = mongoose.model('Topbar', topbarSchema);

export default Topbar;
