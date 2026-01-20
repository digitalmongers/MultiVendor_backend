import mongoose from 'mongoose';

const reliabilitySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ['delivery', 'payment', 'return', 'product'],
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
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
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

const Reliability = mongoose.model('Reliability', reliabilitySchema);

export default Reliability;
