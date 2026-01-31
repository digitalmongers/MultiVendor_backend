import mongoose from 'mongoose';

const socialLoginSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      unique: true,
      enum: ['google', 'facebook', 'apple'],
      lowercase: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    // Encrypted Configuration Fields
    config: {
      callbackUrl: { type: String, default: null },
      clientId: { type: String, default: null },
      clientSecret: { type: String, default: null },
      teamId: { type: String, default: null }, // Apple Specific
      keyId: { type: String, default: null }, // Apple Specific
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

const SocialLogin = mongoose.model('SocialLogin', socialLoginSchema);

export default SocialLogin;
