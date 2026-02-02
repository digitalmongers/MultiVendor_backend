import FeaturedDealRepository from '../repositories/featuredDeal.repository.js';
import ProductRepository from '../repositories/product.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';
import { uploadImageFromUrl, deleteMultipleImages } from '../utils/imageUpload.util.js';

class FeaturedDealService {
    async createFeaturedDeal(data) {
        if (new Date(data.endDate) <= new Date(data.startDate)) {
            throw new AppError('End date must be after start date', HTTP_STATUS.BAD_REQUEST, 'INVALID_DATE_RANGE');
        }

        const folder = 'multi-vendor/featured-deals';

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

        const result = await FeaturedDealRepository.create(data);
        await this.invalidateCache();
        return result;
    }

    async getAllFeaturedDeals(query = {}) {
        const { page = 1, limit = 10, title, isPublished } = query;
        const filter = {};
        if (title) filter.title = { $regex: title, $options: 'i' };
        if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

        return await FeaturedDealRepository.findAllWithStats(filter, { createdAt: -1 }, parseInt(page), parseInt(limit));
    }

    async getFeaturedDealById(id) {
        const deal = await FeaturedDealRepository.findByIdPopulated(id);
        if (!deal) throw new AppError('Featured deal not found', HTTP_STATUS.NOT_FOUND, 'DEAL_NOT_FOUND');
        return deal;
    }

    async getPublicFeaturedDealById(id) {
        const deal = await FeaturedDealRepository.model.findOne({ _id: id, isPublished: true })
            .populate({
                path: 'products.product',
                match: { isActive: true, status: 'approved' }
            })
            .lean({ virtuals: true });

        if (!deal) throw new AppError('Featured deal not found', HTTP_STATUS.NOT_FOUND, 'DEAL_NOT_FOUND');

        const now = new Date();
        if (now < deal.startDate || now > deal.endDate) {
            throw new AppError('This deal is not currently active', HTTP_STATUS.BAD_REQUEST, 'DEAL_INACTIVE');
        }

        // Filter products
        deal.products = deal.products.filter(p => p.product && p.isActive !== false);

        return deal;
    }

    async updateFeaturedDeal(id, data) {
        const deal = await FeaturedDealRepository.findById(id);
        if (!deal) throw new AppError('Featured deal not found', HTTP_STATUS.NOT_FOUND, 'DEAL_NOT_FOUND');

        if (data.startDate && data.endDate && new Date(data.endDate) <= new Date(data.startDate)) {
            throw new AppError('End date must be after start date', HTTP_STATUS.BAD_REQUEST, 'INVALID_DATE_RANGE');
        }

        const folder = 'multi-vendor/featured-deals';
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

        const result = await FeaturedDealRepository.update(id, data);

        // Cleanup old images if update was successful
        if (imagesToDelete.length > 0) {
            await deleteMultipleImages(imagesToDelete);
        }

        await this.invalidateCache();
        return result;
    }

    async deleteFeaturedDeal(id) {
        const deal = await FeaturedDealRepository.findById(id);
        if (!deal) throw new AppError('Featured deal not found', HTTP_STATUS.NOT_FOUND, 'DEAL_NOT_FOUND');

        const imagesToDelete = [];
        if (deal.image?.publicId) imagesToDelete.push(deal.image.publicId);
        if (deal.metaImage?.publicId) imagesToDelete.push(deal.metaImage.publicId);

        const result = await FeaturedDealRepository.delete(id);

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

        const result = await FeaturedDealRepository.addProducts(dealId, products);
        await this.invalidateCache();
        return result;
    }

    async removeProductFromDeal(dealId, productId) {
        const result = await FeaturedDealRepository.removeProduct(dealId, productId);
        await this.invalidateCache();
        return result;
    }

    async togglePublishStatus(dealId, isPublished) {
        const result = await FeaturedDealRepository.togglePublish(dealId, isPublished);
        await this.invalidateCache();
        return result;
    }

    async toggleProductStatus(dealId, productId, isActive) {
        const result = await FeaturedDealRepository.toggleProductStatus(dealId, productId, isActive);
        if (!result) throw new AppError('Deal or product not found', HTTP_STATUS.NOT_FOUND);
        await this.invalidateCache();
        return result;
    }

    async getActiveFeaturedDeals(limit = 10) {
        const now = new Date();
        const deals = await FeaturedDealRepository.model.find({
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
     * Platform-wide Product Enrichment for Featured Deals
     */
    async enrichProductsWithFeaturedDeals(products) {
        if (!products || (Array.isArray(products) && products.length === 0)) return products;

        const isArray = Array.isArray(products);
        const productList = isArray ? products : [products];
        const productIds = productList.map(p => p._id.toString());

        // Find ALL active/published featured deals that contain any of these products
        const now = new Date();
        const activeDeals = await FeaturedDealRepository.model.find({
            isPublished: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
            'products.product': { $in: productIds }
        }).lean();

        if (activeDeals.length === 0) return products;

        // Map product ID to its latest featured deal
        const productFeaturedMap = {};
        activeDeals.forEach(deal => {
            deal.products.forEach(dp => {
                const pid = dp.product.toString();
                if (productIds.includes(pid) && dp.isActive !== false) {
                    productFeaturedMap[pid] = {
                        dealTitle: deal.title,
                        discount: dp.discount,
                        discountType: dp.discountType,
                        endDate: deal.endDate
                    };
                }
            });
        });

        productList.forEach(p => {
            const featured = productFeaturedMap[p._id.toString()];
            if (featured) {
                p.featuredDeal = featured;
                // Calculate featured price
                if (featured.discountType === 'flat') {
                    p.featuredPrice = Math.max(0, p.price - featured.discount);
                } else {
                    p.featuredPrice = Math.max(0, p.price - (p.price * (featured.discount / 100)));
                }
            }
        });

        return isArray ? productList : productList[0];
    }

    async invalidateCache() {
        await Cache.delByPattern('featured-deals*');
    }
}

export default new FeaturedDealService();
