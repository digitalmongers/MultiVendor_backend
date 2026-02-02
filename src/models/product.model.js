import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            index: true,
        },
        description: {
            type: String,
            required: true,
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ProductCategory',
            required: true,
            index: true,
        },
        subCategory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ProductSubCategory',
            required: false, // Optional
            index: true,
        },
        vendor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor', // Assuming there is a Vendor model
            required: false, // Optional for Admin products
            index: true,
        },
        brand: {
            type: String,
            trim: true,
            required: false,
        },
        productType: {
            type: String,
            enum: ['physical', 'digital'],
            default: 'physical',
            required: true,
        },
        unit: {
            type: String, // e.g., 'kg', 'pc', 'ltr'
            required: true,
        },
        searchTags: [
            {
                type: String,
                trim: true,
            },
        ],
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        purchasePrice: {
            type: Number,
            required: false, // For vendor tracking
            min: 0,
        },
        tax: {
            type: Number,
            default: 0,
        },
        taxType: {
            type: String,
            enum: ['percent', 'flat'],
            default: 'percent',
        },
        discount: {
            type: Number,
            default: 0,
            min: 0,
        },
        discountType: {
            type: String,
            enum: ['percent', 'flat'],
            default: 'percent',
        },
        shippingCost: {
            type: Number,
            default: 0,
            min: 0,
        },
        multiplyShippingCost: {
            type: Boolean,
            default: false,
        },
        quantity: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
        sku: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        colors: [
            {
                type: String, // Hex code or Name
            }
        ],
        images: [
            {
                url: String,
                publicId: String,
            },
        ],
        thumbnail: {
            url: String,
            publicId: String,
        },
        attributes: [
            {
                attribute: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'ProductAttribute',
                },
                values: [String], // Selected values for this attribute
            },
        ],
        variations: [
            {
                attributeValues: {
                    type: Map,
                    of: String, // e.g., { "Size": "L", "Color": "Red" }
                },
                price: Number,
                sku: String,
                stock: Number,
                image: {
                    url: String,
                    publicId: String
                }
            },
        ],
        seo: {
            metaTitle: String,
            metaDescription: String,
            metaImage: String,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'suspended'],
            default: 'pending',
            index: true,
        },
        isActive: {
            type: Boolean,
            default: false,
            index: true,
        },
        isFeatured: {
            type: Boolean,
            default: false,
            index: true,
        },
        rejectionReason: {
            type: String,
            trim: true,
        },
        videoLink: {
            type: String,
            trim: true
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Indexes for common queries
productSchema.index({ name: 'text', description: 'text', searchTags: 'text' });
productSchema.index({ createdAt: -1 });
productSchema.index({ price: 1 });

const Product = mongoose.model('Product', productSchema);

export default Product;
