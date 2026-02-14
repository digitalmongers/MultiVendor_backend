import FlashDealRepository from '../repositories/flashDeal.repository.js';
import ProductRepository from '../repositories/product.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';
import MultiLayerCache from '../utils/multiLayerCache.js';
import L1Cache from '../utils/l1Cache.js';
import { uploadImageFromUrl, deleteMultipleImages } from '../utils/imageUpload.util.js';

const FLASH_DEAL_CACHE_KEY = 'flash-deals:active';
const FLASH_DEAL_PATTERN = 'flash-deals*';

class FlashDealService {
    async createFlashDeal(data) {
        if (new Date(data.endDate) <= new Date(data.startDate)) {
            throw new AppError('End date must be after start date', HTTP_STATUS.BAD_REQUEST, 'INVALID_DATE_RANGE');
        }

        const folder = 'multi-vendor/flash-deals';

        // Handle Main Image
        if (data.image && typeof data.image === 'string') {
            const upload = await uploadImageFromUrl(data.image, folder);
            data.image = { url: upload.url, publicId: upload.publicId };
        }

        // Handle Meta Image
        if (data.metaImage && typeof data.metaImage === 'string') {
            const upload = await uploadImageFromUrl(data.metaImage, folder);
            data.metaImage = { url: upload.url, publicId: upload.publicId };
        }

        const result = await FlashDealRepository.create(data);
        await this.invalidateCache();
        return result;
    }

    /**
     * Get all flash deals with OFFSET pagination (for admin)
     */
    async getAllFlashDeals(query = {}) {
        const { page = 1, limit = 10, title, isPublished } = query;
        const filter = {};
        if (title) filter.title = { $regex: title, $options: 'i' };
        if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

        return await FlashDealRepository.findAllWithStats(filter, { createdAt: -1 }, parseInt(page), parseInt(limit));
    }

    /**
     * Get active flash deals with CURSOR pagination (for public APIs - fast & scalable)
     * With Multi-Layer Caching
     */
    async getActiveFlashDealsCursor(cursor = null, limit = 10, sortDirection = 'desc') {
        const cacheKey = `flash-deals:cursor:${cursor}:${limit}:${sortDirection}`;
        
        return await MultiLayerCache.get(cacheKey, async () => {
            const now = new Date();
            const filter = {
                isPublished: true,
                startDate: { $lte: now },
                endDate: { $gte: now }
            };

            const result = await FlashDealRepository.findAllWithCursor(filter, cursor, limit, sortDirection);

            // Filter out products that are either null (due to match) or marked inactive in the deal
            result.data.forEach(deal => {
                deal.products = deal.products.filter(p => p.product && p.isActive !== false);
            });

            return result;
        }, { l1TTL: 60, l2TTL: 300 }); // L1: 1min, L2: 5min
    }

    async getFlashDealById(id) {
        const deal = await FlashDealRepository.findByIdPopulated(id);
        if (!deal) throw new AppError('Flash deal not found', HTTP_STATUS.NOT_FOUND, 'DEAL_NOT_FOUND');
        return deal;
    }

    async getPublicFlashDealById(id) {
        const deal = await FlashDealRepository.model.findOne({ _id: id, isPublished: true })
            .populate({
                path: 'products.product',
                match: { isActive: true, status: 'approved' }
            })
            .lean({ virtuals: true });

        if (!deal) throw new AppError('Flash deal not found', HTTP_STATUS.NOT_FOUND, 'DEAL_NOT_FOUND');

        const now = new Date();
        if (now < deal.startDate || now > deal.endDate) {
            throw new AppError('This deal is not currently active', HTTP_STATUS.BAD_REQUEST, 'DEAL_INACTIVE');
        }

        // Filter products
        deal.products = deal.products.filter(p => p.product && p.isActive !== false);

        return deal;
    }

    async updateFlashDeal(id, data) {
        const deal = await FlashDealRepository.findById(id);
        if (!deal) throw new AppError('Flash deal not found', HTTP_STATUS.NOT_FOUND, 'DEAL_NOT_FOUND');

        if (data.startDate && data.endDate && new Date(data.endDate) <= new Date(data.startDate)) {
            throw new AppError('End date must be after start date', HTTP_STATUS.BAD_REQUEST, 'INVALID_DATE_RANGE');
        }

        const folder = 'multi-vendor/flash-deals';
        const imagesToDelete = [];

        // Handle Image Update
        if (data.image && typeof data.image === 'string') {
            const upload = await uploadImageFromUrl(data.image, folder);
            if (deal.image?.publicId) imagesToDelete.push(deal.image.publicId);
            data.image = { url: upload.url, publicId: upload.publicId };
        }

        // Handle Meta Image Update
        if (data.metaImage && typeof data.metaImage === 'string') {
            const upload = await uploadImageFromUrl(data.metaImage, folder);
            if (deal.metaImage?.publicId) imagesToDelete.push(deal.metaImage.publicId);
            data.metaImage = { url: upload.url, publicId: upload.publicId };
        }

        const result = await FlashDealRepository.update(id, data);

        // Cleanup old images if update was successful
        if (imagesToDelete.length > 0) {
            await deleteMultipleImages(imagesToDelete);
        }

        await this.invalidateCache();
        return result;
    }

    async deleteFlashDeal(id) {
        const deal = await FlashDealRepository.findById(id);
        if (!deal) throw new AppError('Flash deal not found', HTTP_STATUS.NOT_FOUND, 'DEAL_NOT_FOUND');

        const imagesToDelete = [];
        if (deal.image?.publicId) imagesToDelete.push(deal.image.publicId);
        if (deal.metaImage?.publicId) imagesToDelete.push(deal.metaImage.publicId);

        const result = await FlashDealRepository.delete(id);

        // Delete from Cloudinary
        if (imagesToDelete.length > 0) {
            await deleteMultipleImages(imagesToDelete);
        }

        await this.invalidateCache();
        return result;
    }

    async addProductsToDeal(dealId, products) {
        // products: [{ product: id, discount: X, discountType: Y }]
        const productIds = products.map(p => p.product);
        const count = await ProductRepository.countDocuments({ _id: { $in: productIds } });

        if (count !== productIds.length) {
            throw new AppError('One or more products not found', HTTP_STATUS.NOT_FOUND, 'PRODUCTS_NOT_FOUND');
        }

        const result = await FlashDealRepository.addProducts(dealId, products);
        await this.invalidateCache();
        return result;
    }

    async removeProductFromDeal(dealId, productId) {
        const result = await FlashDealRepository.removeProduct(dealId, productId);
        await this.invalidateCache();
        return result;
    }

    async togglePublishStatus(dealId, isPublished) {
        const result = await FlashDealRepository.togglePublish(dealId, isPublished);
        await this.invalidateCache();
        return result;
    }

    async toggleProductStatus(dealId, productId, isActive) {
        const result = await FlashDealRepository.toggleProductStatus(dealId, productId, isActive);
        if (!result) throw new AppError('Deal or product not found', HTTP_STATUS.NOT_FOUND);
        await this.invalidateCache();
        return result;
    }

    /**
     * Get active flash deals (simple list without pagination)
     * @deprecated Use getActiveFlashDealsCursor for better performance
     */
    async getActiveFlashDeals(limit = 10) {
        const now = new Date();
        const deals = await FlashDealRepository.model.find({
            isPublished: true,
            startDate: { $lte: now },
            endDate: { $gte: now }
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate({
                path: 'products.product',
                match: { isActive: true, status: 'approved' }
            })
            .lean({ virtuals: true });

        // Filter out products that are either null (due to match) or marked inactive in the deal
        deals.forEach(deal => {
            deal.products = deal.products.filter(p => p.product && p.isActive !== false);
        });

        return deals;
    }

    /**
     * Platform-wide Product Enrichment
     * Calculates flashDeal price if product is part of an active/published flash deal.
     */
    async enrichProductsWithFlashDeals(products) {
        if (!products || (Array.isArray(products) && products.length === 0)) return products;

        const isArray = Array.isArray(products);
        const productList = isArray ? products : [products];
        const productIds = productList.map(p => p._id.toString());

        // Find ALL active/published flash deals that contain any of these products
        const now = new Date();
        const activeDeals = await FlashDealRepository.model.find({
            isPublished: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
            'products.product': { $in: productIds }
        }).lean();

        if (activeDeals.length === 0) return products;

        // Map product ID to its best/latest flash deal
        // Note: Realistically 1 product shouldn't be in 2 active flash deals, but we take the latest.
        const productFlashMap = {};
        activeDeals.forEach(deal => {
            deal.products.forEach(dp => {
                const pid = dp.product.toString();
                if (productIds.includes(pid) && dp.isActive !== false) {
                    productFlashMap[pid] = {
                        dealTitle: deal.title,
                        discount: dp.discount,
                        discountType: dp.discountType,
                        endDate: deal.endDate
                    };
                }
            });
        });

        productList.forEach(p => {
            const flash = productFlashMap[p._id.toString()];
            if (flash) {
                p.flashDeal = flash;
                // Calculate flash price
                if (flash.discountType === 'flat') {
                    p.flashPrice = Math.max(0, p.price - flash.discount);
                } else {
                    p.flashPrice = Math.max(0, p.price - (p.price * (flash.discount / 100)));
                }
            }
        });

        return isArray ? productList : productList[0];
    }

    async invalidateCache() {
        await Cache.delByPattern(FLASH_DEAL_PATTERN);
        L1Cache.delByPattern('flash-deals');
    }
}

export default new FlashDealService();
