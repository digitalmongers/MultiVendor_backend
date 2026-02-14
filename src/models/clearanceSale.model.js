import mongoose from 'mongoose';

const clearanceSaleSchema = new mongoose.Schema({
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: false, // Null for Admin/In-house sale
        index: true
    },
    isAdmin: {
        type: Boolean,
        default: false,
        index: true
    },
    // Configuration
    isActive: {
        type: Boolean,
        default: false
    },
    startDate: {
        type: Date,
        required: true
    },
    expireDate: {
        type: Date,
        required: true
    },
    discountType: {
        type: String,
        enum: ['flat', 'product_wise'],
        default: 'flat',
        required: true
    },
    discountAmount: {
        type: Number,
        default: 0,
        min: 0,
        // Only relevant if discountType is 'flat'
    },
    offerActiveTime: {
        type: String,
        enum: ['always', 'specific_time'],
        default: 'always'
    },
    // Only if specific_time
    startTime: {
        type: String, // Format "HH:mm" e.g. "14:00"
        default: null
    },
    endTime: {
        type: String, // Format "HH:mm"
        default: null
    },

    // SEO / Meta Data
    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    metaImage: {
        url: { type: String },
        publicId: { type: String }
    },

    // Products included in the sale
    products: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }]
}, {
    timestamps: true,
    versionKey: false
});

// ========================================
// PERFORMANCE OPTIMIZATION: Database Indexes
// ========================================

// Index for active sale lookups
clearanceSaleSchema.index({ isActive: 1 });

// Index for date range queries (active sales)
clearanceSaleSchema.index({ startDate: 1, expireDate: 1 });

// Compound index for vendor/admin sales
clearanceSaleSchema.index({ vendor: 1, isAdmin: 1, isActive: 1 });

const ClearanceSale = mongoose.model('ClearanceSale', clearanceSaleSchema);

export default ClearanceSale;
