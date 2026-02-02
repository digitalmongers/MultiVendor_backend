import ProductRepository from '../repositories/product.repository.js';
import ProductCategoryRepository from '../repositories/productCategory.repository.js';
import ProductSubCategoryRepository from '../repositories/productSubCategory.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';
import Logger from '../utils/logger.js';
import crypto from 'crypto';

const PRODUCT_CACHE_KEY = 'products';

class ProductService {
    /**
     * Helper to generate unique slug
     */
    async generateUniqueSlug(name) {
        let slug = name
            .toLowerCase()
            .replace(/ /g, '-')
            .replace(/[^\w-]+/g, '');

        // Check uniqueness
        let existing = await ProductRepository.findOne({ slug });
        let counter = 1;
        let originalSlug = slug;

        while (existing) {
            slug = `${originalSlug}-${counter}`;
            existing = await ProductRepository.findOne({ slug });
            counter++;
        }

        return slug;
    }

    // --- Vendor Methods ---

    async createProduct(data, vendorId) {
        // 1. Validate Category Exists
        const category = await ProductCategoryRepository.findById(data.category);
        if (!category) {
            throw new AppError('Category not found', HTTP_STATUS.BAD_REQUEST, 'CATEGORY_NOT_FOUND');
        }
        if (category.status !== 'active') {
            throw new AppError('Category is not active', HTTP_STATUS.BAD_REQUEST, 'CATEGORY_INACTIVE');
        }

        // 2. Validate SubCategory if provided
        if (data.subCategory) {
            const subCategory = await ProductSubCategoryRepository.findById(data.subCategory);
            if (!subCategory) {
                throw new AppError('SubCategory not found', HTTP_STATUS.BAD_REQUEST, 'SUBCATEGORY_NOT_FOUND');
            }
            // Verify subcategory belongs to selected category
            if (subCategory.category.toString() !== data.category.toString()) {
                throw new AppError('SubCategory does not belong to selected category', HTTP_STATUS.BAD_REQUEST, 'SUBCATEGORY_MISMATCH');
            }
        }

        // 3. Generate Slug
        data.slug = await this.generateUniqueSlug(data.name);
        data.vendor = vendorId;

        // 4. Validate SKU Uniqueness (Global)
        const existingSku = await ProductRepository.findOne({ sku: data.sku });
        if (existingSku) {
            throw new AppError(`SKU '${data.sku}' already exists`, HTTP_STATUS.CONFLICT, 'DUPLICATE_SKU');
        }

        // 5. Validate Variation SKU Uniqueness
        if (data.variations && data.variations.length > 0) {
            // Check for duplicate SKUs within variations
            const variationSkus = data.variations.map(v => v.sku);
            const uniqueSkus = new Set(variationSkus);
            if (variationSkus.length !== uniqueSkus.size) {
                throw new AppError('Duplicate SKUs found in variations', HTTP_STATUS.BAD_REQUEST, 'DUPLICATE_VARIATION_SKU');
            }

            // Check if any variation SKU already exists in database
            for (const varSku of variationSkus) {
                const existingVarSku = await ProductRepository.findOne({ 'variations.sku': varSku });
                if (existingVarSku) {
                    throw new AppError(`Variation SKU '${varSku}' already exists`, HTTP_STATUS.CONFLICT, 'DUPLICATE_VARIATION_SKU');
                }
            }

            // Calculate Total Quantity from Variations
            data.quantity = data.variations.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
        }

        // 6. Validate Images
        if (!data.images || data.images.length === 0) {
            throw new AppError('At least one product image is required', HTTP_STATUS.BAD_REQUEST, 'IMAGES_REQUIRED');
        }

        // 7. Validate Thumbnail
        if (!data.thumbnail || !data.thumbnail.url) {
            throw new AppError('Product thumbnail is required', HTTP_STATUS.BAD_REQUEST, 'THUMBNAIL_REQUIRED');
        }

        // 8. Validate Pricing
        if (data.discount > 0) {
            if (data.discountType === 'percent' && data.discount > 100) {
                throw new AppError('Discount percentage cannot exceed 100%', HTTP_STATUS.BAD_REQUEST, 'INVALID_DISCOUNT');
            }
            if (data.discountType === 'flat' && data.discount >= data.price) {
                throw new AppError('Flat discount cannot be equal to or greater than price', HTTP_STATUS.BAD_REQUEST, 'INVALID_DISCOUNT');
            }
        }

        // 9. Create Product
        const product = await ProductRepository.create(data);

        // 10. Invalidate Public List Cache
        await this.invalidateCache();

        return product;
    }

    async getVendorProducts(vendorId, query) {
        const filter = { vendor: vendorId, ...query.filter };
        return await ProductRepository.findAll(filter, query.sort, query.page, query.limit);
    }

    async getLimitedStockProducts(vendorId, query) {
        // Filter for products with stock less than threshold
        const { PAGINATION, INVENTORY } = (await import('../constants.js')).CONFIG;
        const lowStockThreshold = INVENTORY?.LOW_STOCK_THRESHOLD || 10;

        const filter = {
            vendor: vendorId,
            quantity: { $lt: lowStockThreshold },
            ...query.filter
        };

        return await ProductRepository.findAll(filter, query.sort, query.page, query.limit);
    }

    async restockProduct(id, data, vendorId) {
        const product = await ProductRepository.findById(id);
        if (!product) {
            throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }

        // Authorization Check
        if (product.vendor._id.toString() !== vendorId.toString()) {
            throw new AppError('Not authorized to restock this product', HTTP_STATUS.FORBIDDEN, 'FORBIDDEN_ACCESS');
        }

        return await this._performStockUpdate(product, data);
    }

    async _performStockUpdate(product, data) {
        let totalQuantity = product.quantity;
        let isUpdated = false;

        // 1. Update simple quantity
        if (data.quantity && data.quantity > 0) {
            if (!product.variations || product.variations.length === 0) {
                totalQuantity += data.quantity;
                isUpdated = true;
            } else {
                if (!data.variations) {
                    throw new AppError('This product has variations. Please restock specific variations.', HTTP_STATUS.BAD_REQUEST, 'VARIATIONS_REQUIRED');
                }
            }
        }

        // 2. Update variations
        if (data.variations && data.variations.length > 0) {
            if (!product.variations || product.variations.length === 0) {
                throw new AppError('This product does not have variations.', HTTP_STATUS.BAD_REQUEST, 'NO_VARIATIONS');
            }

            for (const updateVar of data.variations) {
                const variation = product.variations.find(v => v.sku === updateVar.sku);
                if (variation) {
                    variation.stock = (parseInt(variation.stock) || 0) + parseInt(updateVar.stock);
                    isUpdated = true;
                }
            }

            totalQuantity = product.variations.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
        }

        if (!isUpdated) {
            throw new AppError('No valid stock updates provided', HTTP_STATUS.BAD_REQUEST, 'NO_UPDATES');
        }

        const updateData = { quantity: totalQuantity, variations: product.variations };
        const updated = await ProductRepository.update(product._id, updateData);
        await this.invalidateCache();
        return updated;
    }

    async getVendorProductStats(vendorId) {
        // Get product counts by status for vendor dashboard
        const { INVENTORY } = (await import('../constants.js')).CONFIG;
        const lowStockThreshold = INVENTORY?.LOW_STOCK_THRESHOLD || 10;

        const [total, pending, approved, rejected, suspended, active, featured, lowStock] = await Promise.all([
            ProductRepository.count({ vendor: vendorId }),
            ProductRepository.count({ vendor: vendorId, status: 'pending' }),
            ProductRepository.count({ vendor: vendorId, status: 'approved' }),
            ProductRepository.count({ vendor: vendorId, status: 'rejected' }),
            ProductRepository.count({ vendor: vendorId, status: 'suspended' }),
            ProductRepository.count({ vendor: vendorId, isActive: true }),
            ProductRepository.count({ vendor: vendorId, isFeatured: true }),
            ProductRepository.count({ vendor: vendorId, quantity: { $lt: lowStockThreshold } }), // Add low stock count
        ]);

        return {
            total,
            byStatus: {
                pending,
                approved,
                rejected,
                suspended
            },
            active,
            featured,
            lowStock // Return low stock count
        };
    }

    async getAllProducts(query) {
        // Public caching implemented in controller or route if needed, 
        // but usually simple lists are cached.
        // For filtered lists, we might not cache everything or use complex keys.
        // Here we just fetch.
        // Default filter: Approved AND Active AND Vendor Active
        const defaultFilter = {
            status: 'approved',
            isActive: true,
        };
        const filter = query.filter ? { ...defaultFilter, ...query.filter } : defaultFilter;

        return await ProductRepository.findAll(filter, query.sort, query.page, query.limit);
    }

    async searchProducts(searchQuery, limit = 20) {
        // Lightweight search for search bar autocomplete
        // Returns only essential fields for performance
        if (!searchQuery || searchQuery.trim().length < 2) {
            return [];
        }

        const filter = {
            status: 'approved',
            isActive: true,
            quantity: { $gt: 0 },
            search: searchQuery.trim()
        };

        // Use repository but limit fields returned
        const result = await ProductRepository.findAll(filter, { createdAt: -1 }, 1, limit);

        // Return lightweight data for search suggestions
        return result.products.map(p => ({
            _id: p._id,
            name: p.name,
            price: p.price,
            discount: p.discount,
            discountType: p.discountType,
            thumbnail: p.thumbnail,
            slug: p.slug,
            category: p.category?.name,
            vendor: p.vendor?.businessName || 'Admin' // Default to Admin
        }));
    }

    async getProductById(id) {
        // Try Cache for individual product? 
        // Usually detailed view is high traffic.
        const product = await ProductRepository.findById(id);
        if (!product) {
            throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }
        return product;
    }

    async getPublicProductById(id) {
        const product = await ProductRepository.findById(id);
        if (!product) {
            throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }

        // Strict Filtering: Hide variations with 0 stock
        if (product.variations && product.variations.length > 0) {
            product.variations = product.variations.filter(v => v.stock > 0);
        }

        return product;
    }

    async getSimilarProducts(productId, limit = 10) {
        // Get the current product to extract search tags
        const currentProduct = await ProductRepository.findById(productId);
        if (!currentProduct) {
            throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }

        // If no search tags, return products from same category
        if (!currentProduct.searchTags || currentProduct.searchTags.length === 0) {
            const filter = {
                status: 'approved',
                isActive: true,
                quantity: { $gt: 0 },
                category: currentProduct.category._id || currentProduct.category,
                _id: { $ne: productId } // Exclude current product
            };
            const result = await ProductRepository.findAll(filter, { createdAt: -1 }, 1, limit);
            return result.products;
        }

        // Find products with matching search tags
        const filter = {
            status: 'approved',
            isActive: true,
            quantity: { $gt: 0 },
            searchTags: { $in: currentProduct.searchTags }, // Match any of the tags
            _id: { $ne: productId } // Exclude current product
        };

        const result = await ProductRepository.findAll(filter, { createdAt: -1 }, 1, limit);
        return result.products;
    }

    async updateProduct(id, data, vendorId) {
        const product = await ProductRepository.findById(id);
        if (!product) {
            throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }

        // Authorization Check
        if (product.vendor._id.toString() !== vendorId.toString()) {
            throw new AppError('Not authorized to update this product', HTTP_STATUS.FORBIDDEN, 'FORBIDDEN_ACCESS');
        }

        // Re-Approval Logic: If product is currently approved and vendor is making changes,
        // reset to pending status for Admin review
        const isContentUpdate = data.name || data.description || data.price || data.category ||
            data.subCategory || data.images || data.variations || data.discount;

        if (product.status === 'approved' && isContentUpdate) {
            data.status = 'pending';
            data.isActive = false; // Force hide until re-approved
            // Note: We don't touch isActive if vendor is ONLY toggling it without content changes
        }

        // Restriction: Vendor can ONLY toggle isActive if status is 'approved'
        // If they define isActive: true, we must check current status (or updated status)
        const finalStatus = data.status || product.status;
        if (data.isActive === true && finalStatus !== 'approved') {
            throw new AppError('Cannot activate product until it is approved by Admin', HTTP_STATUS.FORBIDDEN, 'PRODUCT_NOT_APPROVED');
        }

        // Validate Category if being updated
        if (data.category) {
            const category = await ProductCategoryRepository.findById(data.category);
            if (!category) {
                throw new AppError('Category not found', HTTP_STATUS.BAD_REQUEST, 'CATEGORY_NOT_FOUND');
            }
            if (category.status !== 'active') {
                throw new AppError('Category is not active', HTTP_STATUS.BAD_REQUEST, 'CATEGORY_INACTIVE');
            }
        }

        // Validate SubCategory if being updated
        if (data.subCategory) {
            const subCategory = await ProductSubCategoryRepository.findById(data.subCategory);
            if (!subCategory) {
                throw new AppError('SubCategory not found', HTTP_STATUS.BAD_REQUEST, 'SUBCATEGORY_NOT_FOUND');
            }
            // Verify subcategory belongs to selected category (use existing category if not being updated)
            const categoryId = data.category || product.category._id.toString();
            if (subCategory.category.toString() !== categoryId.toString()) {
                throw new AppError('SubCategory does not belong to selected category', HTTP_STATUS.BAD_REQUEST, 'SUBCATEGORY_MISMATCH');
            }
        }

        // Validate pricing if discount is being updated
        if (data.discount !== undefined && data.discount > 0) {
            const price = data.price || product.price;
            const discountType = data.discountType || product.discountType;

            if (discountType === 'percent' && data.discount > 100) {
                throw new AppError('Discount percentage cannot exceed 100%', HTTP_STATUS.BAD_REQUEST, 'INVALID_DISCOUNT');
            }
            if (discountType === 'flat' && data.discount >= price) {
                throw new AppError('Flat discount cannot be equal to or greater than price', HTTP_STATUS.BAD_REQUEST, 'INVALID_DISCOUNT');
            }
        }

        // Validate images if being updated
        if (data.images !== undefined && (!data.images || data.images.length === 0)) {
            throw new AppError('At least one product image is required', HTTP_STATUS.BAD_REQUEST, 'IMAGES_REQUIRED');
        }

        // Calculate Total Quantity from Variations (if updating variations)
        if (data.variations && data.variations.length > 0) {
            // Check for duplicate SKUs within variations
            const variationSkus = data.variations.map(v => v.sku);
            const uniqueSkus = new Set(variationSkus);
            if (variationSkus.length !== uniqueSkus.size) {
                throw new AppError('Duplicate SKUs found in variations', HTTP_STATUS.BAD_REQUEST, 'DUPLICATE_VARIATION_SKU');
            }

            // Check if any variation SKU already exists in other products
            for (const varSku of variationSkus) {
                const existingVarSku = await ProductRepository.findOne({
                    'variations.sku': varSku,
                    _id: { $ne: id } // Exclude current product
                });
                if (existingVarSku) {
                    throw new AppError(`Variation SKU '${varSku}' already exists`, HTTP_STATUS.CONFLICT, 'DUPLICATE_VARIATION_SKU');
                }
            }

            data.quantity = data.variations.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
        }

        const updated = await ProductRepository.update(id, data);
        await this.invalidateCache();
        return updated;
    }

    // --- Admin Methods ---

    async adminCreateProduct(data) {
        // 1. Validate Category Exists
        const category = await ProductCategoryRepository.findById(data.category);
        if (!category) {
            throw new AppError('Category not found', HTTP_STATUS.BAD_REQUEST, 'CATEGORY_NOT_FOUND');
        }
        if (category.status !== 'active') {
            // Admin might bypass this? Let's check rule: "Admin jb product banaye... status toggle active kre toh homepage pe bikhe"
            // Safe to assume category must be active for product to be useful.
            throw new AppError('Category is not active', HTTP_STATUS.BAD_REQUEST, 'CATEGORY_INACTIVE');
        }

        // 2. Validate SubCategory
        if (data.subCategory) {
            const subCategory = await ProductSubCategoryRepository.findById(data.subCategory);
            if (!subCategory) {
                throw new AppError('SubCategory not found', HTTP_STATUS.BAD_REQUEST, 'SUBCATEGORY_NOT_FOUND');
            }
            if (subCategory.category.toString() !== data.category.toString()) {
                throw new AppError('SubCategory does not belong to selected category', HTTP_STATUS.BAD_REQUEST, 'SUBCATEGORY_MISMATCH');
            }
        }

        // 3. Generate Slug
        data.slug = await this.generateUniqueSlug(data.name);

        // 4. Set Admin specific fields
        data.vendor = undefined; // No vendor for admin products
        data.status = 'approved'; // Auto-approved
        // data.isActive is respected from payload (default false per schema default, but admin might send true)

        // 5. Validate SKU Uniqueness
        const existingSku = await ProductRepository.findOne({ sku: data.sku });
        if (existingSku) {
            throw new AppError(`SKU '${data.sku}' already exists`, HTTP_STATUS.CONFLICT, 'DUPLICATE_SKU');
        }

        // 6. Validate Variation SKUs
        if (data.variations && data.variations.length > 0) {
            const variationSkus = data.variations.map(v => v.sku);
            const uniqueSkus = new Set(variationSkus);
            if (variationSkus.length !== uniqueSkus.size) {
                throw new AppError('Duplicate SKUs found in variations', HTTP_STATUS.BAD_REQUEST, 'DUPLICATE_VARIATION_SKU');
            }

            for (const varSku of variationSkus) {
                const existingVarSku = await ProductRepository.findOne({ 'variations.sku': varSku });
                if (existingVarSku) {
                    throw new AppError(`Variation SKU '${varSku}' already exists`, HTTP_STATUS.CONFLICT, 'DUPLICATE_VARIATION_SKU');
                }
            }
            // Calc quantity
            data.quantity = data.variations.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
        }

        // 7. Validate Images/Thumbnail
        if (!data.images || data.images.length === 0) {
            throw new AppError('At least one product image is required', HTTP_STATUS.BAD_REQUEST, 'IMAGES_REQUIRED');
        }
        if (!data.thumbnail || !data.thumbnail.url) {
            throw new AppError('Product thumbnail is required', HTTP_STATUS.BAD_REQUEST, 'THUMBNAIL_REQUIRED');
        }

        // 8. Validate Pricing
        if (data.discount > 0) {
            if (data.discountType === 'percent' && data.discount > 100) {
                throw new AppError('Discount percentage cannot exceed 100%', HTTP_STATUS.BAD_REQUEST, 'INVALID_DISCOUNT');
            }
            if (data.discountType === 'flat' && data.discount >= data.price) {
                throw new AppError('Flat discount cannot be equal to or greater than price', HTTP_STATUS.BAD_REQUEST, 'INVALID_DISCOUNT');
            }
        }

        const product = await ProductRepository.create(data);
        await this.invalidateCache();
        return product;
    }

    async adminUpdateProductStatus(id, status, reason) {
        const product = await ProductRepository.findById(id);
        if (!product) {
            throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }

        const updateData = { status };

        // If Rejected, set reason and force inactive
        if (status === 'rejected') {
            if (!reason) throw new AppError('Rejection reason is required', HTTP_STATUS.BAD_REQUEST, 'REASON_REQUIRED');
            updateData.rejectionReason = reason;
            updateData.isActive = false; // Force hide
        }

        // If Approved, we can clear rejection reason (optional, but good practice)
        if (status === 'approved') {
            updateData.rejectionReason = ''; // Clear previous reason
            // Admin can optionally set isActive via separate update, or frontend sends it.
            // Usually approval doesn't auto-activate unless requested, to let vendor decide launch timing.
        }

        const updated = await ProductRepository.update(id, updateData);
        await this.invalidateCache();
        return updated;
    }

    async adminUpdateProduct(id, data) {
        // Admin bypasses vendor checks
        const product = await ProductRepository.findById(id);
        if (!product) {
            throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }

        // Recalculate stock if variations touched
        if (data.variations && data.variations.length > 0) {
            data.quantity = data.variations.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
        }

        const updated = await ProductRepository.update(id, data);
        await this.invalidateCache();
        return updated;
    }

    async adminGetAllProducts(query) {
        // Admin sees ALL products, no default filters applied unless specified
        const filter = query.filter || {};
        return await ProductRepository.findAll(filter, query.sort, query.page, query.limit);
    }

    async adminGetProductById(id) {
        // Admin sees raw product data including rejection reasons etc.
        const product = await ProductRepository.findById(id);
        if (!product) {
            throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }
        return product;
    }

    async getAdminInHouseProducts(query) {
        const filter = {
            $or: [{ vendor: { $exists: false } }, { vendor: null }],
            ...query.filter
        };
        return await ProductRepository.findAll(filter, query.sort, query.page, query.limit);
    }

    async getAdminLimitedStockProducts(query) {
        // Filter for admin products (no vendor) with stock < threshold
        const { PAGINATION, INVENTORY } = (await import('../constants.js')).CONFIG;
        const lowStockThreshold = INVENTORY?.LOW_STOCK_THRESHOLD || 10;

        const filter = {
            $or: [{ vendor: { $exists: false } }, { vendor: null }],
            quantity: { $lt: lowStockThreshold },
            ...query.filter
        };

        return await ProductRepository.findAll(filter, query.sort, query.page, query.limit);
    }

    async adminRestockProduct(id, data) {
        const product = await ProductRepository.findById(id);
        if (!product) {
            throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }

        // Only allow restocking In-House products via this method? OR allow Admin to restock ANY product?
        // User said "admin apne product ka dekh ske". 
        // Let's restrict to In-House for safety on this specific API, 
        // since Admin can already Full-Edit any product. But "Restock" is a convenience method.
        // If Admin wants to restock a Vendor product, they should probably do it securely or via full edit.
        // But let's allow "adminRestockProduct" to work on In-House primarily.
        // IF we strictly force in-house:
        /*
        if (product.vendor) {
            throw new AppError('This is a vendor product. Use Admin Edit or dedicated override.', HTTP_STATUS.FORBIDDEN, 'VENDOR_PRODUCT');
        }
        */
        // But usually Admin is Superuser. Let's allowing restocking ANY product is helpful for support.
        // BUT user specifically said "admin apne product ka dekh ske". 
        // "limited stock" view specifically shows "apne product".
        // So let's handle the Restock just like the View: Universal capability is better but View is scoped.

        return await this._performStockUpdate(product, data);
    }

    async getAdminProductStats() {
        // Get comprehensive product statistics for admin dashboard
        const [total, pending, approved, rejected, suspended, active, featured, outOfStock] = await Promise.all([
            ProductRepository.count({}),
            ProductRepository.count({ status: 'pending' }),
            ProductRepository.count({ status: 'approved' }),
            ProductRepository.count({ status: 'rejected' }),
            ProductRepository.count({ status: 'suspended' }),
            ProductRepository.count({ isActive: true }),
            ProductRepository.count({ isFeatured: true }),
            ProductRepository.count({ quantity: 0 }),
        ]);

        return {
            total,
            byStatus: {
                pending, // New product requests
                approved,
                rejected,
                suspended
            },
            active,
            featured,
            outOfStock,
            inStock: total - outOfStock
        };
    }

    async adminDeleteProduct(id) {
        // Admin can delete any product without authorization checks
        const product = await ProductRepository.findById(id);
        if (!product) {
            throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }

        // TODO: cleanup images from Cloudinary

        await ProductRepository.delete(id);
        await this.invalidateCache();
        return true;
    }

    async adminBulkImportProducts(excelBuffer) {
        const { parseProductExcel } = await import('../utils/excelParser.util.js');
        const { uploadImageFromUrl, uploadMultipleImagesFromUrls, deleteMultipleImages } = await import('../utils/imageUpload.util.js');
        const mongoose = await import('mongoose');

        // Parse and validate Excel (Pass undefined for vendorId)
        const parseResult = await parseProductExcel(excelBuffer, undefined);

        if (!parseResult.success) {
            return {
                success: false,
                created: 0,
                failed: parseResult.errors.length,
                errors: parseResult.errors,
                message: parseResult.message
            };
        }

        const products = parseResult.products;

        Logger.info('Starting admin bulk product import', {
            productCount: products.length
        });

        const session = await mongoose.default.startSession();
        session.startTransaction();

        const createdProducts = [];
        const uploadedImages = [];
        const errors = [];

        try {
            for (let i = 0; i < products.length; i++) {
                const productData = products[i];
                const rowIndex = i + 2;

                try {
                    // 1. Validate SKU uniqueness
                    const existingSku = await ProductRepository.findOne({ sku: productData.sku });
                    if (existingSku) {
                        throw new Error(`SKU '${productData.sku}' already exists`);
                    }

                    // 2. Generate unique slug
                    productData.slug = await this.generateUniqueSlug(productData.name);

                    // 3. Handle image uploads
                    const imageFolder = `multi-vendor/admin/products`; // Admin specific folder

                    if (productData._thumbnailUrl) {
                        try {
                            const thumbnailResult = await uploadImageFromUrl(productData._thumbnailUrl, imageFolder);
                            productData.thumbnail = { url: thumbnailResult.url, publicId: thumbnailResult.publicId };
                            uploadedImages.push(thumbnailResult.publicId);
                        } catch (error) {
                            Logger.warn('Thumbnail upload failed, using first image as thumbnail', { row: rowIndex, error: error.message });
                        }
                    }

                    if (productData._imageUrls && productData._imageUrls.length > 0) {
                        const imageResults = await uploadMultipleImagesFromUrls(productData._imageUrls, imageFolder);
                        if (imageResults.length > 0) {
                            productData.images = imageResults.map(img => ({ url: img.url, publicId: img.publicId }));
                            uploadedImages.push(...imageResults.map(img => img.publicId));
                            if (!productData.thumbnail) {
                                productData.thumbnail = productData.images[0];
                            }
                        }
                    }

                    if (!productData.images || productData.images.length === 0) {
                        throw new Error('At least one product image is required.');
                    }
                    if (!productData.thumbnail) {
                        throw new Error('Product thumbnail is required.');
                    }

                    // 4. Validate Pricing & Variations (Same as vendor)
                    if (productData.discount > 0) {
                        if (productData.discountType === 'percent' && productData.discount > 100) throw new Error('Discount percentage cannot exceed 100%');
                        if (productData.discountType === 'flat' && productData.discount >= productData.price) throw new Error('Flat discount cannot be >= price');
                    }

                    if (productData.variations && productData.variations.length > 0) {
                        const variationSkus = productData.variations.map(v => v.sku);
                        const uniqueSkus = new Set(variationSkus);
                        if (variationSkus.length !== uniqueSkus.size) throw new Error('Duplicate SKUs found in variations');

                        for (const varSku of variationSkus) {
                            const existingVarSku = await ProductRepository.findOne({ 'variations.sku': varSku });
                            if (existingVarSku) throw new Error(`Variation SKU '${varSku}' already exists`);
                        }
                        productData.quantity = productData.variations.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
                    }

                    // 5. Cleanup
                    delete productData._thumbnailUrl;
                    delete productData._imageUrls;

                    // 6. Admin Specific Overrides
                    // Vendor is undefined (from parser default)
                    productData.status = 'approved'; // Auto-approved
                    productData.isActive = false;    // Hidden by default, Admin toggles later

                    const product = await ProductRepository.create(productData);
                    createdProducts.push(product);

                } catch (error) {
                    errors.push({ row: rowIndex, sku: productData.sku, name: productData.name, error: error.message });
                    throw error; // Fail fast on transaction
                }
            }

            await session.commitTransaction();
            await this.invalidateCache();
            return { success: true, created: createdProducts.length, failed: 0, products: createdProducts };

        } catch (error) {
            await session.abortTransaction();
            if (uploadedImages.length > 0) await deleteMultipleImages(uploadedImages);

            return {
                success: false,
                created: 0,
                failed: products.length, // All failed due to transaction rollback
                errors: errors.length > 0 ? errors : [{ error: error.message }],
                message: 'Bulk import failed. No products were created.'
            };
        } finally {
            session.endSession();
        }
    }

    async adminToggleFeatured(id, isFeatured) {
        const product = await ProductRepository.findById(id);
        if (!product) {
            throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }

        const updated = await ProductRepository.update(id, { isFeatured });
        await this.invalidateCache();
        return updated;
    }

    async getFeaturedProducts(limit = 10) {
        // Public API: Get featured products (approved, active, vendor active)
        const filter = {
            status: 'approved',
            isActive: true,
            isFeatured: true,
            quantity: { $gt: 0 }
        };

        const result = await ProductRepository.findAll(filter, { createdAt: -1 }, 1, limit);
        return result.products;
    }

    async deleteProduct(id, vendorId) {
        const product = await ProductRepository.findById(id);
        if (!product) {
            throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }

        // Authorization Check
        if (product.vendor._id.toString() !== vendorId.toString()) {
            throw new AppError('Not authorized to delete this product', HTTP_STATUS.FORBIDDEN, 'FORBIDDEN_ACCESS');
        }

        // TODO: cleanup images from Cloudinary

        await ProductRepository.delete(id);
        await this.invalidateCache();
        return true;
    }

    async invalidateCache() {
        await Cache.delByPattern(`${PRODUCT_CACHE_KEY}*`);
        await Cache.delByPattern('response:/api/v1/products*');
    }

    /**
     * Bulk Import Products from Excel
     * Enterprise-grade bulk import with transaction support
     * 
     * @param {Buffer} excelBuffer - Excel file buffer
     * @param {string} vendorId - Vendor ID
     * @returns {Promise<{success: boolean, created: number, failed: number, errors?: Array}>}
     */
    async bulkImportProducts(excelBuffer, vendorId) {
        const { parseProductExcel } = await import('../utils/excelParser.util.js');
        const { uploadImageFromUrl, uploadMultipleImagesFromUrls, deleteMultipleImages } = await import('../utils/imageUpload.util.js');
        const mongoose = await import('mongoose');

        // Parse and validate Excel
        const parseResult = await parseProductExcel(excelBuffer, vendorId);

        if (!parseResult.success) {
            // Return validation errors
            return {
                success: false,
                created: 0,
                failed: parseResult.errors.length,
                errors: parseResult.errors,
                message: parseResult.message
            };
        }

        const products = parseResult.products;

        Logger.info('Starting bulk product import', {
            vendorId,
            productCount: products.length
        });

        // Start MongoDB transaction for atomicity
        const session = await mongoose.default.startSession();
        session.startTransaction();

        const createdProducts = [];
        const uploadedImages = []; // Track for cleanup on failure
        const errors = [];

        try {
            // Process each product
            for (let i = 0; i < products.length; i++) {
                const productData = products[i];
                const rowIndex = i + 2; // Excel row number (1-indexed + header row)

                try {
                    // 1. Validate SKU uniqueness
                    const existingSku = await ProductRepository.findOne({ sku: productData.sku });
                    if (existingSku) {
                        throw new Error(`SKU '${productData.sku}' already exists`);
                    }

                    // 2. Generate unique slug
                    productData.slug = await this.generateUniqueSlug(productData.name);

                    // 3. Handle image uploads from URLs
                    const imageFolder = `multi-vendor/vendor-${vendorId}/products`;

                    // Upload thumbnail if provided
                    if (productData._thumbnailUrl) {
                        try {
                            const thumbnailResult = await uploadImageFromUrl(
                                productData._thumbnailUrl,
                                imageFolder
                            );
                            productData.thumbnail = {
                                url: thumbnailResult.url,
                                publicId: thumbnailResult.publicId
                            };
                            uploadedImages.push(thumbnailResult.publicId);
                        } catch (error) {
                            Logger.warn('Thumbnail upload failed, using first image as thumbnail', {
                                vendorId,
                                row: rowIndex,
                                error: error.message
                            });
                            // Will use first product image as thumbnail
                        }
                    }

                    // Upload product images if provided
                    if (productData._imageUrls && productData._imageUrls.length > 0) {
                        const imageResults = await uploadMultipleImagesFromUrls(
                            productData._imageUrls,
                            imageFolder
                        );

                        if (imageResults.length > 0) {
                            productData.images = imageResults.map(img => ({
                                url: img.url,
                                publicId: img.publicId
                            }));

                            uploadedImages.push(...imageResults.map(img => img.publicId));

                            // Use first image as thumbnail if thumbnail upload failed
                            if (!productData.thumbnail) {
                                productData.thumbnail = productData.images[0];
                            }
                        }
                    }

                    // 4. Validate required images
                    if (!productData.images || productData.images.length === 0) {
                        throw new Error('At least one product image is required. Please provide valid image URLs.');
                    }

                    if (!productData.thumbnail) {
                        throw new Error('Product thumbnail is required. Please provide a valid thumbnail URL.');
                    }

                    // 5. Validate pricing
                    if (productData.discount > 0) {
                        if (productData.discountType === 'percent' && productData.discount > 100) {
                            throw new Error('Discount percentage cannot exceed 100%');
                        }
                        if (productData.discountType === 'flat' && productData.discount >= productData.price) {
                            throw new Error('Flat discount cannot be equal to or greater than price');
                        }
                    }

                    // 6. Validate variations if provided
                    if (productData.variations && productData.variations.length > 0) {
                        // Check for duplicate SKUs within variations
                        const variationSkus = productData.variations.map(v => v.sku);
                        const uniqueSkus = new Set(variationSkus);
                        if (variationSkus.length !== uniqueSkus.size) {
                            throw new Error('Duplicate SKUs found in variations');
                        }

                        // Check if any variation SKU already exists in database
                        for (const varSku of variationSkus) {
                            const existingVarSku = await ProductRepository.findOne({ 'variations.sku': varSku });
                            if (existingVarSku) {
                                throw new Error(`Variation SKU '${varSku}' already exists`);
                            }
                        }

                        // Calculate total quantity from variations
                        productData.quantity = productData.variations.reduce(
                            (sum, v) => sum + (parseInt(v.stock) || 0),
                            0
                        );
                    }

                    // 7. Clean up temporary fields
                    delete productData._thumbnailUrl;
                    delete productData._imageUrls;

                    // 8. Set default status (pending approval)
                    productData.status = 'pending';
                    productData.isActive = false;

                    // 9. Create product with transaction
                    const product = await ProductRepository.create(productData);
                    createdProducts.push(product);

                    Logger.info('Product created in bulk import', {
                        vendorId,
                        productId: product._id,
                        sku: product.sku,
                        row: rowIndex
                    });

                } catch (error) {
                    // Collect error for this row
                    errors.push({
                        row: rowIndex,
                        sku: productData.sku,
                        name: productData.name,
                        error: error.message
                    });

                    Logger.error('Product creation failed in bulk import', {
                        vendorId,
                        row: rowIndex,
                        sku: productData.sku,
                        error: error.message
                    });

                    // Fail fast: If any product fails, rollback entire transaction
                    throw error;
                }
            }

            // Commit transaction if all products created successfully
            await session.commitTransaction();

            // Invalidate cache after successful import
            await this.invalidateCache();

            Logger.info('Bulk import completed successfully', {
                vendorId,
                created: createdProducts.length
            });

            return {
                success: true,
                created: createdProducts.length,
                failed: 0,
                message: `Successfully imported ${createdProducts.length} products. All products are pending admin approval.`,
                products: createdProducts.map(p => ({
                    _id: p._id,
                    name: p.name,
                    sku: p.sku,
                    status: p.status
                }))
            };

        } catch (error) {
            // Rollback transaction on any error
            await session.abortTransaction();

            // Cleanup uploaded images from Cloudinary
            if (uploadedImages.length > 0) {
                Logger.info('Rolling back: Deleting uploaded images from Cloudinary', {
                    vendorId,
                    imageCount: uploadedImages.length
                });

                await deleteMultipleImages(uploadedImages);
            }

            Logger.error('Bulk import failed, transaction rolled back', {
                vendorId,
                error: error.message,
                created: 0,
                failed: products.length
            });

            // Return detailed error report
            return {
                success: false,
                created: 0,
                failed: products.length,
                errors: errors.length > 0 ? errors : [{
                    error: error.message,
                    message: 'Bulk import failed. All changes have been rolled back.'
                }],
                message: `Bulk import failed: ${error.message}. No products were created.`
            };

        } finally {
            // End session
            await session.endSession();
        }
    }

    // --- Export Methods ---

    async exportVendorProducts(vendorId, filter = {}) {
        // Get all vendor products without pagination for export
        filter.vendor = vendorId;
        const result = await ProductRepository.findAll(filter, { createdAt: -1 }, 1, 10000);
        return result.products;
    }

    async exportAdminProducts(filter = {}) {
        // Get all products without pagination for export
        const result = await ProductRepository.findAll(filter, { createdAt: -1 }, 1, 10000);
        return result.products;
    }
}

export default new ProductService();
