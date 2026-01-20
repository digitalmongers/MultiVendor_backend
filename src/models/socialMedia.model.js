import mongoose from 'mongoose';

const socialMediaSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ['Facebook', 'Instagram', 'YouTube', 'LinkedIn', 'X'],
      required: true,
      unique: true,
    },
    link: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
socialMediaSchema.index({ status: 1 });

const SocialMedia = mongoose.model('SocialMedia', socialMediaSchema);

export default SocialMedia;
