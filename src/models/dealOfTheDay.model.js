import mongoose from 'mongoose';

const dealOfTheDaySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    products: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        discount: {
            type: Number,
            default: 0
        },
        discountType: {
            type: String,
            enum: ['flat', 'percent'],
            default: 'percent'
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    isPublished: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

dealOfTheDaySchema.index({ title: 1 });
dealOfTheDaySchema.index({ 'products.product': 1 });

const DealOfTheDay = mongoose.model('DealOfTheDay', dealOfTheDaySchema);

export default DealOfTheDay;
