import mongoose from 'mongoose';

const paymentGatewaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ['paypal', 'razorpay', 'stripe', 'payu', 'ccavenue'],
      lowercase: true,
    },
    title: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    // Encrypted Configuration Fields
    config: {
      apiKey: { type: String, default: null },
      apiSecret: { type: String, default: null },
      webhookSecret: { type: String, default: null },
      clientId: { type: String, default: null }, // Specifically for PayPal
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const PaymentGateway = mongoose.model('PaymentGateway', paymentGatewaySchema);

export default PaymentGateway;
