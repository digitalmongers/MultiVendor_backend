import mongoose from 'mongoose';

const sliderSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    buttonText: {
      type: String,
      trim: true,
      default: '',
    },
    buttonUrl: {
      type: String,
      trim: true,
      default: '',
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

// Indexes
sliderSchema.index({ published: 1 });
sliderSchema.index({ createdAt: -1 });

const Slider = mongoose.model('Slider', sliderSchema);

export default Slider;
