import mongoose from 'mongoose';

const loginSettingSchema = new mongoose.Schema(
  {
    maxOtpHit: {
      type: Number,
      required: true,
      default: 3,
    },
    otpResendTime: {
      type: Number,
      required: true,
      default: 60, // seconds
    },
    temporaryBlockTime: {
      type: Number,
      required: true,
      default: 21600, // seconds (6 hours)
    },
    maxLoginHit: {
      type: Number,
      required: true,
      default: 3,
    },
    temporaryLoginBlockTime: {
      type: Number,
      required: true,
      default: 21600, // seconds (6 hours)
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

// Ensure only one settings document exists
const LoginSetting = mongoose.model('LoginSetting', loginSettingSchema);

export default LoginSetting;
