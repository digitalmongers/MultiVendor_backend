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

const SmsGateway = mongoose.model('SmsGateway', smsGatewaySchema);

export default SmsGateway;
