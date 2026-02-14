import mongoose from 'mongoose';

const reliabilitySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ['delivery', 'payment', 'return', 'product'],
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      url: {
        type: String,
        required: true,
      },
      publicId: {
        type: String,
        required: true,
      },
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

// Note: key index is already created by { unique: true } in schema definition

// Index for active status filtering
reliabilitySchema.index({ status: 1 });

// Index for key-based lookups
reliabilitySchema.index({ key: 1, status: 1 });

const Reliability = mongoose.model('Reliability', reliabilitySchema);

export default Reliability;
