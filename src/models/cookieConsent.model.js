import mongoose from 'mongoose';

const cookieConsentSchema = new mongoose.Schema(
  {
    isActive: {
      type: Boolean,
      required: true,
      default: false,
    },
    content: {
      type: String,
      required: function() {
        return this.isActive;
      },
      trim: true,
    },
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

// Ensure only one document exists
const CookieConsent = mongoose.model('CookieConsent', cookieConsentSchema);

export default CookieConsent;
