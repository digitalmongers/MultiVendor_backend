import mongoose from 'mongoose';

const wishlistItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const wishlistSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
        unique: true, // One wishlist per customer
        index: true
    },
    items: [wishlistItemSchema]
}, {
    timestamps: true,
    versionKey: false
});

// Compound index for fast product lookup
wishlistSchema.index({ customer: 1, 'items.product': 1 });

// Virtual for total items count
wishlistSchema.virtual('totalItems').get(function () {
    return this.items.length;
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

export default Wishlist;
