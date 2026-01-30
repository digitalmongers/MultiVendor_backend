import mongoose from 'mongoose';
import { hashPassword, comparePassword } from '../utils/security.js';
import { ROLES } from '../constants.js';

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    phoneNumber: {
      type: String,
      match: [/^[6-9]\d{9}$/, 'Please add a valid phone number'],
      trim: true,
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
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.CUSTOMER,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
      select: false,
    },
    verificationCodeExpires: {
      type: Date,
      select: false,
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
    lastPasswordReset: {
      type: Date,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password using Argon2 (assuming security.js uses it)
customerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  this.password = await hashPassword(this.password);
});

// Match user entered password to hashed password in database
customerSchema.methods.matchPassword = async function (enteredPassword) {
  return await comparePassword(this.password, enteredPassword);
};

// Virtual for account lockout status
customerSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;
