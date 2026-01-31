import mongoose from 'mongoose';
import { hashPassword, comparePassword } from '../utils/security.js';
import { ROLES, VENDOR_STATUS } from '../constants.js';

const vendorSchema = new mongoose.Schema(
  {
    // Step 1 Fields
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Please add a phone number'],
      match: [/^[6-9]\d{9}$/, 'Please add a valid phone number'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },

    // Step 2 Fields - Personal
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'First name cannot be more than 50 characters'],
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Last name cannot be more than 50 characters'],
    },
    photo: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },

    // Step 2 Fields - Business
    businessName: {
      type: String,
      trim: true,
    },
    businessAddress: {
      type: String,
      trim: true,
    },
    businessLogo: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    businessBanner: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },

    // Step 2 Fields - Business TIN (Optional)
    businessTin: {
      number: { type: String, trim: true },
      expiryDate: { type: Date },
      certificate: {
        url: { type: String, default: null },
        publicId: { type: String, default: null },
      },
    },

    // Step 2 Fields - Tax & Legal (Optional Section, but fields mandatory IF section provided)
    taxAndLegal: {
      gstNumber: { type: String, trim: true },
      panNumber: { type: String, trim: true },
      taxRegistrationNumber: { type: String, trim: true },
      gstDocument: {
        url: { type: String, default: null },
        publicId: { type: String, default: null },
      },
      panDocument: {
        url: { type: String, default: null },
        publicId: { type: String, default: null },
      },
      addressProof: {
        url: { type: String, default: null },
        publicId: { type: String, default: null },
      },
    },
    
    // Bank Information
    bankDetails: {
      bankName: { type: String, trim: true },
      accountHolderName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
    },

    // Metadata
    role: {
      type: String,
      enum: [ROLES.VENDOR],
      default: ROLES.VENDOR,
    },
    status: {
      type: String,
      enum: Object.values(VENDOR_STATUS),
      default: VENDOR_STATUS.INACTIVE,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lockUntil: {
      type: Date,
      select: false,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    otpLockUntil: {
      type: Date,
      select: false,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    registrationStep: {
        type: Number,
        default: 1
    },
    
    // Admin Creation Metadata
    createdBy: {
      type: String,
      enum: ['self', 'admin'],
      default: 'self',
    },
    createdByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
  },
);

// ========================================
// PERFORMANCE OPTIMIZATION: Database Indexes
// ========================================

// Note: Email index is already created by { unique: true } in schema definition

// Index for authentication queries (login)
vendorSchema.index({ email: 1, status: 1 });

// Index for admin filtering by status
vendorSchema.index({ status: 1, createdAt: -1 });

// Compound index for search queries (firstName, lastName, businessName)
vendorSchema.index({ firstName: 'text', lastName: 'text', businessName: 'text', email: 'text' });

// Index for token version check (session validation)
vendorSchema.index({ _id: 1, tokenVersion: 1 });

// Index for phone number lookup
vendorSchema.index({ phoneNumber: 1 });

// Encrypt password
vendorSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  this.password = await hashPassword(this.password);
});

// Match password
vendorSchema.methods.matchPassword = async function (enteredPassword) {
  return await comparePassword(this.password, enteredPassword);
};

const Vendor = mongoose.model('Vendor', vendorSchema);

export default Vendor;
