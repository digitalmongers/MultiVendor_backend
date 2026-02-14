import ClearanceSaleRepository from '../repositories/clearanceSale.repository.js';
import ProductRepository from '../repositories/product.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';
import L1Cache from '../utils/l1Cache.js';
import { uploadImageFromUrl, deleteMultipleImages } from '../utils/imageUpload.util.js';

class ClearanceSaleService {

    async getSaleConfig(vendorId) {
        return await ClearanceSaleRepository.findByVendor(vendorId);
    }

    async getAdminSaleConfig() {
        return await ClearanceSaleRepository.findAdminSale();
    }

    async upsertSaleConfig(data, vendorId) {
        // Validate dates
        if (data.startDate && data.expireDate) {
            if (new Date(data.expireDate) <= new Date(data.startDate)) {
                throw new AppError('Expire date must be after start date', HTTP_STATUS.BAD_REQUEST, 'INVALID_DATE_RANGE');
            }
        }

        let existing = await ClearanceSaleRepository.findByVendor(vendorId);

        // Handle meta image upload
        if (data.metaImage && typeof data.metaImage === 'string') {
            const upload = await uploadImageFromUrl(data.metaImage, 'clearance-sales/meta');
            // If replacing, add old one to delete list
            if (existing?.metaImage?.publicId) {
                await deleteMultipleImages([existing.metaImage.publicId]);
            }
            data.metaImage = { url: upload.url, publicId: upload.publicId };
        }

        let result;
        if (existing) {
            result = await ClearanceSaleRepository.update(existing._id, data);
        } else {
            data.vendor = vendorId;
            result = await ClearanceSaleRepository.create(data);
        }

        await this.invalidateCache(vendorId);
        return result;
    }

    async upsertAdminSaleConfig(data) {
        if (data.startDate && data.expireDate) {
            if (new Date(data.expireDate) <= new Date(data.startDate)) {
                throw new AppError('Expire date must be after start date', HTTP_STATUS.BAD_REQUEST, 'INVALID_DATE_RANGE');
            }
        }

        let existing = await ClearanceSaleRepository.findAdminSale();

        // Handle meta image upload
        if (data.metaImage && typeof data.metaImage === 'string') {
            const upload = await uploadImageFromUrl(data.metaImage, 'admin/clearance-sales/meta');
            if (existing?.metaImage?.publicId) {
                await deleteMultipleImages([existing.metaImage.publicId]);
            }
            data.metaImage = { url: upload.url, publicId: upload.publicId };
        }

        let result;
        if (existing) {
            result = await ClearanceSaleRepository.update(existing._id, data);
        } else {
            data.isAdmin = true;
            data.vendor = null;
            result = await ClearanceSaleRepository.create(data);
        }

        await this.invalidateCache();
        return result;
    }

    async toggleStatus(isActive, vendorId) {
        const existing = await ClearanceSaleRepository.findByVendor(vendorId);
        if (!existing) {
            throw new AppError('Clearance sale configuration not found', HTTP_STATUS.NOT_FOUND, 'SALE_NOT_FOUND');
        }

        const result = await ClearanceSaleRepository.update(existing._id, { isActive });
        await this.invalidateCache(vendorId);
        return result;
    }

    async toggleAdminStatus(isActive) {
        const existing = await ClearanceSaleRepository.findAdminSale();
        if (!existing) {
            throw new AppError('Clearance sale configuration not found', HTTP_STATUS.NOT_FOUND, 'SALE_NOT_FOUND');
        }

        const result = await ClearanceSaleRepository.update(existing._id, { isActive });
        await this.invalidateCache();
        return result;
    }

    async addProducts(productIds, vendorId) {
        const sale = await ClearanceSaleRepository.findByVendor(vendorId);
        if (!sale) {
            throw new AppError('Please setup clearance sale configuration first', HTTP_STATUS.BAD_REQUEST, 'SETUP_REQUIRED');
        }

        // Verify products belong to vendor
        const count = await ProductRepository.count({
            _id: { $in: productIds },
            vendor: vendorId
        });

        if (count !== productIds.length) {
            throw new AppError('One or more products do not belong to you or do not exist', HTTP_STATUS.FORBIDDEN, 'INVALID_PRODUCTS');
        }

        const result = await ClearanceSaleRepository.addProducts(vendorId, productIds);
        await this.invalidateCache(vendorId);
        // Also invalidate product caches as their price/display might change?
        // Ideally yes, but depends on if we store "isSale" on product. We don't.
        // But the "Home" page might fetch "Clearance Products".
        return result;
    }

    async removeProduct(productId, vendorId) {
        const result = await ClearanceSaleRepository.removeProduct(vendorId, productId);
        await this.invalidateCache(vendorId);
        return result;
    }

    async addAdminProducts(productIds) {
        const sale = await ClearanceSaleRepository.findAdminSale();
        if (!sale) {
            throw new AppError('Please setup clearance sale configuration first', HTTP_STATUS.BAD_REQUEST, 'SETUP_REQUIRED');
        }

        // Verify products are in-house (vendor is null or undefined)
        const count = await ProductRepository.count({
            _id: { $in: productIds },
            $or: [{ vendor: null }, { vendor: { $exists: false } }]
        });

        if (count !== productIds.length) {
            throw new AppError('One or more products are not in-house (administered by you)', HTTP_STATUS.FORBIDDEN, 'INVALID_PRODUCTS');
        }

        const result = await ClearanceSaleRepository.addProducts(null, productIds, true);
        await this.invalidateCache();
        return result;
    }

    async removeAdminProduct(productId) {
        const result = await ClearanceSaleRepository.removeProduct(null, productId, true);
        await this.invalidateCache();
        return result;
    }

    async toggleProductStatus(productId, isActive, vendorId) {
        const result = await ClearanceSaleRepository.toggleProductStatus(vendorId, productId, isActive);
        if (!result) {
            throw new AppError('Product not found in clearance sale', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }
        await this.invalidateCache(vendorId);
        return result;
    }

    async toggleAdminProductStatus(productId, isActive) {
        const result = await ClearanceSaleRepository.toggleProductStatus(null, productId, isActive, true);
        if (!result) {
            throw new AppError('Product not found in clearance sale', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }
        await this.invalidateCache();
        return result;
    }

    async invalidateCache(vendorId) {
        await Cache.delByPattern('clearance*');
        L1Cache.delByPattern('clearance');
    }

    async getPublicSales(limit = 10) {
        const cacheKey = `clearance:public:${limit}`;
        
        // Try L1 first
        const l1Cached = L1Cache.get(cacheKey);
        if (l1Cached) {
            return l1Cached;
        }

        // Try L2
        const l2Cached = await Cache.get(cacheKey);
        if (l2Cached) {
            L1Cache.set(cacheKey, l2Cached, 300);
            return l2Cached;
        }

        // Fetch all ACTIVE clearance sales
        const result = await ClearanceSaleRepository.findAllActive(limit);
        
        // Cache results
        await Cache.set(cacheKey, result, 1800);
        L1Cache.set(cacheKey, result, 300); // L1: 5min

        return result;
    }

    async enrichProductsWithSales(products) {
        if (!products || (Array.isArray(products) && products.length === 0)) return products;

        const isArray = Array.isArray(products);
        const productList = isArray ? products : [products];

        // Get unique vendor IDs and flag if there are admin products
        const vendorIds = [...new Set(productList.map(p => p.vendor?._id || p.vendor).filter(id => id))];
        const hasAdminProducts = productList.some(p => !p.vendor);

        // Fetch active sales
        const now = new Date();
        const saleQuery = {
            isActive: true,
            startDate: { $lte: now },
            expireDate: { $gte: now },
            $or: [
                { vendor: { $in: vendorIds } },
                { isAdmin: true }
            ]
        };

        const activeSales = await ClearanceSaleRepository.model.find(saleQuery).lean();

        if (activeSales.length === 0) return products;

        // Map sales
        const salesByVendor = {};
        let adminSale = null;

        activeSales.forEach(sale => {
            if (sale.isAdmin) {
                adminSale = sale;
            } else if (sale.vendor) {
                salesByVendor[sale.vendor.toString()] = sale;
            }
        });

        productList.forEach(p => {
            const vendorId = (p.vendor?._id || p.vendor)?.toString();
            const sale = vendorId ? salesByVendor[vendorId] : adminSale;

            if (sale) {
                // Check if product is in this sale and active
                const saleProduct = sale.products?.find(sp => sp.product.toString() === p._id.toString());
                if (saleProduct && saleProduct.isActive) {
                    p.clearanceSale = {
                        discountType: sale.discountType,
                        discountAmount: sale.discountAmount,
                        offerActiveTime: sale.offerActiveTime,
                        startTime: sale.startTime,
                        endTime: sale.endTime,
                        metaTitle: sale.metaTitle
                    };

                    if (sale.discountType === 'flat') {
                        p.salePrice = sale.discountAmount > 0
                            ? Math.max(0, p.price - (p.price * (sale.discountAmount / 100)))
                            : p.price;
                    }
                }
            }
        });

        return isArray ? productList : productList[0];
    }
}

export default new ClearanceSaleService();
