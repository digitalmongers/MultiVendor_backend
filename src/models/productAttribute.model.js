import mongoose from 'mongoose';


const productAttributeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    values: [
      {
        type: String,
        trim: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee', // Or 'User' depending on who updates
    },
  },
  {
    timestamps: true,
  }
);

// ========================================
// PERFORMANCE OPTIMIZATION: Database Indexes
// ========================================

// Note: name index is already created by { unique: true } in schema definition

// Index for active attribute lookups
productAttributeSchema.index({ isActive: 1 });

// Index for name search
productAttributeSchema.index({ name: 'text' });

const ProductAttribute = mongoose.model('ProductAttribute', productAttributeSchema);

export default ProductAttribute;
