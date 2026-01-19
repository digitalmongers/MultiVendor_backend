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

const ProductCategory = mongoose.model('ProductCategory', productCategorySchema);

export default ProductCategory;
