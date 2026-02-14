import mongoose from 'mongoose';

const smsGatewaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ['2factor', 'twilio'],
      lowercase: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    // Encrypted Configuration Fields
    config: {
      apiKey: { type: String, default: null }, // For 2Factor
      sid: { type: String, default: null }, // For Twilio
      token: { type: String, default: null }, // For Twilio
      messagingServiceSid: { type: String, default: null }, // For Twilio
      from: { type: String, default: null }, // For Twilio
      otpTemplate: { type: String, default: 'Your OTP is {otp}' },
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

// Note: name index is already created by { unique: true } in schema definition

// Index for active SMS gateway lookups
smsGatewaySchema.index({ isActive: 1 });

// Compound index for active gateway by name
smsGatewaySchema.index({ name: 1, isActive: 1 });

const SmsGateway = mongoose.model('SmsGateway', smsGatewaySchema);

export default SmsGateway;
