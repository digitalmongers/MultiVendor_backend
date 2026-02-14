import mongoose from 'mongoose';

const socialMediaChatSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      required: true,
      unique: true,
      enum: ['whatsapp'],
      lowercase: true,
    },
    value: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'updatedByModel',
    },
    updatedByModel: {
      type: String,
      enum: ['Admin', 'Employee'],
      default: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

// ========================================
// PERFORMANCE OPTIMIZATION: Database Indexes
// ========================================

// Note: platform index is already created by { unique: true } in schema definition

// Index for active chat platform lookups
socialMediaChatSchema.index({ isActive: 1 });

// Compound index for active platform lookup
socialMediaChatSchema.index({ platform: 1, isActive: 1 });

const SocialMediaChat = mongoose.model('SocialMediaChat', socialMediaChatSchema);

export default SocialMediaChat;
