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

const ProductSubCategory = mongoose.model('ProductSubCategory', productSubCategorySchema);

export default ProductSubCategory;
