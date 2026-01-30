import mongoose from 'mongoose';

const supplierEmailTemplateSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      required: [true, 'Event type is required'],
      unique: true,
      enum: [
        'Registration',
        'Registration Approved',
        'Registration Denied',
        'Account Suspended',
        'Account Activation',
        'Order Received',
      ],
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    logo: {
      url: String,
      publicId: String,
    },
    mainIcon: {
      url: String,
      publicId: String,
    },
    templateTitle: {
      type: String,
      required: [true, 'Template title is required'],
      trim: true,
    },
    emailContent: {
      type: String,
      required: [true, 'Email content is required'],
    },
    footerDescription: {
      type: String,
      trim: true,
    },
    copyrightNotice: {
      type: String,
      trim: true,
    },
    includedLinks: {
      privacyPolicy: { type: Boolean, default: false },
      refundPolicy: { type: Boolean, default: false },
      cancellationPolicy: { type: Boolean, default: false },
      contactUs: { type: Boolean, default: false },
    },
    socialMediaLinks: {
      facebook: { type: Boolean, default: false },
      instagram: { type: Boolean, default: false },
      twitter: { type: Boolean, default: false },
      linkedin: { type: Boolean, default: false },
      youtube: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// model for event lookups
const SupplierEmailTemplate = mongoose.model('SupplierEmailTemplate', supplierEmailTemplateSchema);

export default SupplierEmailTemplate;
