import WishlistRepository from '../repositories/wishlist.repository.js';
import ProductRepository from '../repositories/product.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Logger from '../utils/logger.js';
import ClearanceSaleService from './clearanceSale.service.js';
import FlashDealService from './flashDeal.service.js';
import FeaturedDealService from './featuredDeal.service.js';
import DealOfTheDayService from './dealOfTheDay.service.js';

class WishlistService {
    /**
     * Get customer wishlist with enriched product details
     */
    async getWishlist(customerId) {
        const wishlist = await WishlistRepository.findByCustomer(customerId);

        if (!wishlist || !wishlist.items || wishlist.items.length === 0) {
            return {
                items: [],
                totalItems: 0,
                message: 'Wishlist is empty'
            };
        }

        // Filter out inactive or deleted products
        const activeItems = wishlist.items.filter(item =>
            item.product &&
            item.product.isActive === true &&
            item.product.status === 'approved'
        );

        // Enrich products with active deals
        const enrichedItems = await this.enrichWishlistItems(activeItems);

        return {
            items: enrichedItems,
            totalItems: enrichedItems.length
        };
    }

    /**
     * Add product to wishlist
     */
    async addToWishlist(customerId, productId) {
        // 1. Validate product exists and is available
        const product = await ProductRepository.findById(productId);

        if (!product) {
            throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }

        if (product.status !== 'approved' || !product.isActive) {
            throw new AppError('Product is not available', HTTP_STATUS.BAD_REQUEST, 'PRODUCT_UNAVAILABLE');
        }

        // 2. Check if already in wishlist
        const isInWishlist = await WishlistRepository.isProductInWishlist(customerId, productId);

        if (isInWishlist) {
            throw new AppError('Product is already in your wishlist', HTTP_STATUS.CONFLICT, 'ALREADY_IN_WISHLIST');
        }

        // 3. Add to wishlist
        await WishlistRepository.addProduct(customerId, productId);

        Logger.info('Product added to wishlist', {
            customerId,
            productId
        });

        return await this.getWishlist(customerId);
    }

    /**
     * Remove product from wishlist
     */
    async removeFromWishlist(customerId, productId) {
        await WishlistRepository.removeProduct(customerId, productId);

        Logger.info('Product removed from wishlist', {
            customerId,
            productId
        });

        return await this.getWishlist(customerId);
    }

    /**
     * Check if product is in wishlist
     */
    async isInWishlist(customerId, productId) {
        const isInWishlist = await WishlistRepository.isProductInWishlist(customerId, productId);

        return {
            isInWishlist
        };
    }

    /**
     * Clear entire wishlist
     */
    async clearWishlist(customerId) {
        await WishlistRepository.clearWishlist(customerId);

        Logger.info('Wishlist cleared', { customerId });

        return {
            items: [],
            totalItems: 0,
            message: 'Wishlist cleared successfully'
        };
    }

    /**
     * Enrich wishlist items with active deals and calculate final prices
     */
    async enrichWishlistItems(items) {
        const enrichedItems = [];

        for (const item of items) {
            const product = item.product;

            // Calculate base price (with product discount if any)
            let basePrice = product.price;
            if (product.discount > 0) {
                if (product.discountType === 'flat') {
                    basePrice = product.price - product.discount;
                } else if (product.discountType === 'percent') {
                    basePrice = product.price - (product.price * product.discount / 100);
                }
            }

            // Check for active deals
            let finalPrice = basePrice;
            let activeDeal = null;

            // Enrich with deals
            const enrichedProduct = await ClearanceSaleService.enrichProductsWithSales(product);
            const withFlash = await FlashDealService.enrichProductsWithFlashDeals(enrichedProduct);
            const withFeatured = await FeaturedDealService.enrichProductsWithFeaturedDeals(withFlash);
            const withDaily = await DealOfTheDayService.enrichProductsWithDailyDeals(withFeatured);

            // Determine final price from deals
            if (withDaily.dailyDeal) {
                finalPrice = withDaily.dailyDealPrice;
                activeDeal = { type: 'daily', ...withDaily.dailyDeal };
            } else if (withFeatured.featuredDeal) {
                finalPrice = withFeatured.featuredPrice;
                activeDeal = { type: 'featured', ...withFeatured.featuredDeal };
            } else if (withFlash.flashDeal) {
                finalPrice = withFlash.flashPrice;
                activeDeal = { type: 'flash', ...withFlash.flashDeal };
            } else if (enrichedProduct.salePrice) {
                finalPrice = enrichedProduct.salePrice;
                activeDeal = { type: 'clearance' };
            }

            enrichedItems.push({
                product: {
                    _id: product._id,
                    name: product.name,
                    slug: product.slug,
                    thumbnail: product.thumbnail,
                    price: product.price,
                    discount: product.discount,
                    discountType: product.discountType,
                    quantity: product.quantity
                },
                basePrice: parseFloat(basePrice.toFixed(2)),
                finalPrice: parseFloat(finalPrice.toFixed(2)),
                activeDeal,
                addedAt: item.addedAt
            });
        }

        return enrichedItems;
    }
}

export default new WishlistService();
