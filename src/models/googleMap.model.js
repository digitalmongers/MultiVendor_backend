import mongoose from 'mongoose';

const googleMapSchema = new mongoose.Schema(
  {
    isActive: {
      type: Boolean,
      default: false,
    },
    // Encrypted Configuration Fields
    config: {
      clientKey: { type: String, default: null }, // Used for Frontend/Browser
      serverKey: { type: String, default: null }, // Used for Backend/Server-side
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'updatedByModel',
    },
    updatedByModel: {
      type: String,
      enum: ['Admin', 'Employee'],
      default: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Singleton model for Google Map settings.
 */
const GoogleMap = mongoose.model('GoogleMap', googleMapSchema);

export default GoogleMap;
