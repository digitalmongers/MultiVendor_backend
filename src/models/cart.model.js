import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    },
    variation: {
        type: String,
        default: null // e.g., "Size: L, Color: Red"
    },
    quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity must be at least 1'],
        max: [100, 'Quantity cannot exceed 100']
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

const cartSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        default: null,
        index: true,
        sparse: true // Allow multiple null values
    },
    guestId: {
        type: String,
        default: null,
        index: true,
        sparse: true,
        validate: {
            validator: function (v) {
                // UUID v4 format validation
                return !v || /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
            },
            message: 'Invalid guest ID format'
        }
    },
    items: [cartItemSchema],
    expiresAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    versionKey: false
});

// Compound indexes for fast lookups
cartSchema.index({ customer: 1, 'items.product': 1 });
cartSchema.index({ guestId: 1, 'items.product': 1 });

// TTL index for auto-cleanup of expired guest carts
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Validation: Either customer OR guestId must be present
cartSchema.pre('save', function (next) {
    if (!this.customer && !this.guestId) {
        return next(new Error('Either customer or guestId must be provided'));
    }
    if (this.customer && this.guestId) {
        return next(new Error('Cannot have both customer and guestId'));
    }

    // Set expiry for guest carts (7 days)
    if (this.guestId && !this.expiresAt) {
        this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    next();
});

// Virtual for total items count
cartSchema.virtual('totalItems').get(function () {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
