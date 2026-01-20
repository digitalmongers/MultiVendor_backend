import mongoose from 'mongoose';

const trustedBySchema = new mongoose.Schema(
  {
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

// Indexes
trustedBySchema.index({ status: 1 });
trustedBySchema.index({ createdAt: -1 });

const TrustedBy = mongoose.model('TrustedBy', trustedBySchema);

export default TrustedBy;
