import mongoose from 'mongoose';

const paymentSettingSchema = new mongoose.Schema(
  {
    isCodActive: {
      type: Boolean,
      default: true,
    },
    isDigitalPaymentActive: {
      type: Boolean,
      default: true,
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

/**
 * Singleton model for global payment settings.
 */
const PaymentSetting = mongoose.model('PaymentSetting', paymentSettingSchema);

export default PaymentSetting;
