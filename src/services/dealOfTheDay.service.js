import DealOfTheDayRepository from '../repositories/dealOfTheDay.repository.js';
import ProductRepository from '../repositories/product.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';
import MultiLayerCache from '../utils/multiLayerCache.js';
import L1Cache from '../utils/l1Cache.js';

const DEAL_CACHE_KEY = 'deals:active';
const DEAL_PATTERN = 'deals*';

class DealOfTheDayService {
    async createDeal(data) {
        const result = await DealOfTheDayRepository.create(data);
        await this.invalidateCache();
        return result;
    }

    async getAllDeals(query = {}) {
        const { page = 1, limit = 10, title, isPublished } = query;
        const filter = {};
        if (title) filter.title = { $regex: title, $options: 'i' };
        if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

        return await DealOfTheDayRepository.findAllWithStats(filter, { createdAt: -1 }, parseInt(page), parseInt(limit));
    }

    async getDealById(id) {
        const deal = await DealOfTheDayRepository.findByIdPopulated(id);
        if (!deal) throw new AppError('Deal not found', HTTP_STATUS.NOT_FOUND, 'DEAL_NOT_FOUND');
        return deal;
    }

    async getPublicDealById(id) {
        const deal = await DealOfTheDayRepository.model.findOne({ _id: id, isPublished: true })
            .populate({
                path: 'products.product',
                match: { isActive: true, status: 'approved' }
            })
            .lean({ virtuals: true });

        if (!deal) throw new AppError('Deal not found', HTTP_STATUS.NOT_FOUND, 'DEAL_NOT_FOUND');

        // Filter products
        deal.products = deal.products.filter(p => p.product && p.isActive !== false);

        return deal;
    }

    async updateDeal(id, data) {
        const result = await DealOfTheDayRepository.update(id, data);
        if (!result) throw new AppError('Deal not found', HTTP_STATUS.NOT_FOUND, 'DEAL_NOT_FOUND');
        await this.invalidateCache();
        return result;
    }

    async deleteDeal(id) {
        const result = await DealOfTheDayRepository.delete(id);
        if (!result) throw new AppError('Deal not found', HTTP_STATUS.NOT_FOUND, 'DEAL_NOT_FOUND');
        await this.invalidateCache();
        return result;
    }

    async addProductsToDeal(dealId, products) {
        const productIds = products.map(p => p.product);
        const count = await ProductRepository.countDocuments({ _id: { $in: productIds } });

        if (count !== productIds.length) {
            throw new AppError('One or more products not found', HTTP_STATUS.NOT_FOUND, 'PRODUCTS_NOT_FOUND');
        }

        const result = await DealOfTheDayRepository.addProducts(dealId, products);
        await this.invalidateCache();
        return result;
    }

    async removeProductFromDeal(dealId, productId) {
        const result = await DealOfTheDayRepository.removeProduct(dealId, productId);
        await this.invalidateCache();
        return result;
    }

    async togglePublishStatus(dealId, isPublished) {
        const result = await DealOfTheDayRepository.togglePublish(dealId, isPublished);
        await this.invalidateCache();
        return result;
    }

    async toggleProductStatus(dealId, productId, isActive) {
        const result = await DealOfTheDayRepository.toggleProductStatus(dealId, productId, isActive);
        if (!result) throw new AppError('Deal or product not found', HTTP_STATUS.NOT_FOUND);
        await this.invalidateCache();
        return result;
    }

    /**
     * Get active deals with CURSOR pagination (for public APIs - fast & scalable)
     * With Multi-Layer Caching
     */
    async getActiveDealsCursor(cursor = null, limit = 10, sortDirection = 'desc') {
        const cacheKey = `deals:cursor:${cursor}:${limit}:${sortDirection}`;

        return await MultiLayerCache.get(cacheKey, async () => {
            const filter = { isPublished: true };

            const result = await DealOfTheDayRepository.findAllWithCursor(filter, cursor, limit, sortDirection);

            // Filter products
            result.data.forEach(deal => {
                deal.products = deal.products.filter(p => p.product && p.isActive !== false);
            });

            return result;
        }, { l1TTL: 60, l2TTL: 300 }); // L1: 1min, L2: 5min
    }

    /**
     * Get active deals (simple list without pagination)
     * @deprecated Use getActiveDealsCursor for better performance
     */
    async getActiveDeals(limit = 10) {
        const deals = await DealOfTheDayRepository.model.find({ isPublished: true })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate({
                path: 'products.product',
                match: { isActive: true, status: 'approved' }
            })
            .lean({ virtuals: true });

        deals.forEach(deal => {
            deal.products = deal.products.filter(p => p.product && p.isActive !== false);
        });

        return deals;
    }

    /**
     * Platform-wide Product Enrichment for Deal of the Day
     */
    async enrichProductsWithDailyDeals(products) {
        if (!products || (Array.isArray(products) && products.length === 0)) return products;

        const isArray = Array.isArray(products);
        const productList = isArray ? products : [products];
        const productIds = productList.map(p => p._id.toString());

        // Find ALL published deals that contain any of these products
        const activeDeals = await DealOfTheDayRepository.model.find({
            isPublished: true,
            'products.product': { $in: productIds }
        }).lean();

        if (activeDeals.length === 0) return products;

        const productDealMap = {};
        activeDeals.forEach(deal => {
            deal.products.forEach(dp => {
                const pid = dp.product.toString();
                if (productIds.includes(pid) && dp.isActive !== false) {
                    productDealMap[pid] = {
                        dealTitle: deal.title
                    };
                }
            });
        });

        productList.forEach(p => {
            const deal = productDealMap[p._id.toString()];
            if (deal) {
                p.dealOfTheDay = deal;
            }
        });

        return isArray ? productList : productList[0];
    }

    async invalidateCache() {
        await Cache.delByPattern(DEAL_PATTERN);
        L1Cache.delByPattern('deals');
    }
}

export default new DealOfTheDayService();
