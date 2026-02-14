import mongoose from 'mongoose';

const productCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    logo: {
      type: {
        url: String,
        publicId: String,
      },
      required: false,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// ========================================
// PERFORMANCE OPTIMIZATION: Database Indexes
// ========================================

// Note: name index is already created by { unique: true } in schema definition

// Index for active category lookups
productCategorySchema.index({ status: 1 });

// Index for name search
productCategorySchema.index({ name: 'text' });

const ProductCategory = mongoose.model('ProductCategory', productCategorySchema);

export default ProductCategory;
