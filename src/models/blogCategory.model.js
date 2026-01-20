import mongoose from 'mongoose';

const blogCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// Index for filtering by status
blogCategorySchema.index({ status: 1 });

const BlogCategory = mongoose.model('BlogCategory', blogCategorySchema);

export default BlogCategory;
