import mongoose from 'mongoose';
import { BANNER_TYPES, RESOURCE_TYPES } from '../constants.js';

const bannerSchema = new mongoose.Schema(
  {
    bannerType: {
      type: String,
      enum: Object.values(BANNER_TYPES),
      required: true,
    },
    bannerUrl: {
      type: String,
      trim: true,
      default: '',
    },
    resourceType: {
      type: String,
      enum: Object.values(RESOURCE_TYPES),
      required: true,
    },
    image: {
      url: {
        type: String,
        required: true,
      },
      publicId: {
        type: String,
        required: true,
      },
    },
    published: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
bannerSchema.index({ bannerType: 1 });
bannerSchema.index({ published: 1 });

const Banner = mongoose.model('Banner', bannerSchema);

export default Banner;
