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

// ========================================
// PERFORMANCE OPTIMIZATION: Database Indexes
// ========================================

// Note: event index is already created by { unique: true } in schema definition

// Index for enabled template lookups
supplierEmailTemplateSchema.index({ isEnabled: 1 });

// Compound index for active event lookup
supplierEmailTemplateSchema.index({ event: 1, isEnabled: 1 });

const SupplierEmailTemplate = mongoose.model('SupplierEmailTemplate', supplierEmailTemplateSchema);

export default SupplierEmailTemplate;
