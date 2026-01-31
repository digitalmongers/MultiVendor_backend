import mongoose from 'mongoose';

const systemSettingSchema = new mongoose.Schema(
  {
    appName: {
      type: String,
      required: true,
      default: 'Multi Vendor',
      trim: true,
    },
    appDebug: {
      type: Boolean,
      required: true,
      default: true, // Default to true as requested
      comment: 'If true, stack traces are shown in API responses',
    },
    appMode: {
      type: String,
      enum: ['Live', 'Dev', 'Maintenance'],
      required: true,
      default: 'Live',
    },
    appUrl: {
      type: String,
      required: true,
      trim: true,
    },
    // Audit Fields
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'updatedByModel',
    },
    updatedByModel: {
      type: String,
      enum: ['Admin', 'Employee'],
    },
  },
  {
    timestamps: true,
  }
);

// Ensure single document pattern
const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);

export default SystemSetting;
