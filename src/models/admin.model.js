import mongoose from 'mongoose';
import { hashPassword, comparePassword } from '../utils/security.js';

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 8,
      select: false,
    },
    phoneNumber: {
      type: String,
      match: [/^[6-9]\d{9}$/, 'Please add a valid phone number'],
    },
    photo: {
      url: {
        type: String,
        default: null,
      },
      publicId: {
        type: String,
        default: null,
      },
    },
    resetPasswordOtp: String,
    resetPasswordExpires: Date,
    resetPasswordOtpAttempts: {
      type: Number,
      default: 0,
    },
    resetPasswordLockout: Date,
    
    // Login Security
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockoutUntil: Date,
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for session validation
adminSchema.index({ _id: 1, tokenVersion: 1 });

// ========================================
// PERFORMANCE OPTIMIZATION: Database Indexes
// ========================================

// Note: Email index is already created by { unique: true } in schema definition

// Index for phone number lookup
adminSchema.index({ phoneNumber: 1 });

// Index for admin search by name
adminSchema.index({ name: 'text', email: 'text' });

// Encrypt password using Argon2
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  this.password = await hashPassword(this.password);
});

// Match admin entered password to hashed password in database
adminSchema.methods.matchPassword = async function (enteredPassword) {
  return await comparePassword(this.password, enteredPassword);
};

const Admin = mongoose.model('Admin', adminSchema);

export default Admin;
