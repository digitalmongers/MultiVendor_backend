import mongoose from 'mongoose';

const productSubCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductCategory',
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate subcategory names under the same parent category
productSubCategorySchema.index({ name: 1, category: 1 }, { unique: true });

// ========================================
// PERFORMANCE OPTIMIZATION: Database Indexes
// ========================================

// Index for category-based lookups
productSubCategorySchema.index({ category: 1 });

// Index for name search
productSubCategorySchema.index({ name: 'text' });

const ProductSubCategory = mongoose.model('ProductSubCategory', productSubCategorySchema);

export default ProductSubCategory;
