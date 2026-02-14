import mongoose from 'mongoose';
import { SYSTEM_PERMISSIONS } from '../constants.js';

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      trim: true,
    },
    permissions: {
      type: [String],
      enum: Object.values(SYSTEM_PERMISSIONS),
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// ========================================
// PERFORMANCE OPTIMIZATION: Database Indexes
// ========================================

// Note: name index is already created by { unique: true } in schema definition

// Index for active role lookups
roleSchema.index({ isActive: 1 });

// Index for role name search
roleSchema.index({ name: 'text' });

const Role = mongoose.model('Role', roleSchema);

export default Role;
