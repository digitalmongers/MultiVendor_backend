import mongoose from 'mongoose';
import slugify from 'slugify';

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BlogCategory',
      required: true,
    },
    writerName: {
      type: String,
      required: true,
      trim: true,
    },
    publishDate: {
      type: Date,
      default: Date.now,
    },
    blogImage: {
      url: String,
      publicId: String,
    },
    seo: {
      metaTitle: {
        type: String,
        trim: true,
      },
      metaDescription: {
        type: String,
        trim: true,
      },
      metaImage: {
        url: String,
        publicId: String,
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'draft'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

// Slug generation hook
blogSchema.pre('save', function (next) {
  if (this.isModified('title') || !this.slug) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

// Indexes
blogSchema.index({ status: 1 });
blogSchema.index({ category: 1 });
blogSchema.index({ title: 'text' }); // Search optimization

const Blog = mongoose.model('Blog', blogSchema);

export default Blog;
