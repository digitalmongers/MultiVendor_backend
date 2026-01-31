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

const SocialMediaChat = mongoose.model('SocialMediaChat', socialMediaChatSchema);

export default SocialMediaChat;
