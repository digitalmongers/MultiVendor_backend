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
     * OPTIMIZED: Batch processing to prevent N+1 queries
     */
    async enrichWishlistItems(items) {
        if (!items || items.length === 0) return [];

        // Extract all products at once
        const products = items.map(item => item.product);

        // Batch enrich all products in parallel (4 queries total instead of 4*N)
        const [
            withSales,
            withFlash,
            withFeatured,
            withDaily
        ] = await Promise.all([
            ClearanceSaleService.enrichProductsWithSales([...products]),
            FlashDealService.enrichProductsWithFlashDeals([...products]),
            FeaturedDealService.enrichProductsWithFeaturedDeals([...products]),
            DealOfTheDayService.enrichProductsWithDailyDeals([...products])
        ]);

        // Create lookup maps for O(1) access
        const salesMap = new Map(withSales.map((p, i) => [products[i]._id.toString(), p]));
        const flashMap = new Map(withFlash.map((p, i) => [products[i]._id.toString(), p]));
        const featuredMap = new Map(withFeatured.map((p, i) => [products[i]._id.toString(), p]));
        const dailyMap = new Map(withDaily.map((p, i) => [products[i]._id.toString(), p]));

        // Build enriched items
        return items.map((item, index) => {
            const product = item.product;
            const productId = product._id.toString();

            // Calculate base price
            let basePrice = product.price;
            if (product.discount > 0) {
                if (product.discountType === 'flat') {
                    basePrice = product.price - product.discount;
                } else if (product.discountType === 'percent') {
                    basePrice = product.price - (product.price * product.discount / 100);
                }
            }

            // Get enriched product data from maps
            const withSaleProduct = salesMap.get(productId);
            const withFlashProduct = flashMap.get(productId);
            const withFeaturedProduct = featuredMap.get(productId);
            const withDailyProduct = dailyMap.get(productId);

            // Determine final price and active deal
            let finalPrice = basePrice;
            let activeDeal = null;

            if (withDailyProduct?.dealOfTheDay) {
                finalPrice = withDailyProduct.dealPrice;
                activeDeal = { type: 'daily', ...withDailyProduct.dealOfTheDay };
            } else if (withFeaturedProduct?.featuredDeal) {
                finalPrice = withFeaturedProduct.featuredPrice;
                activeDeal = { type: 'featured', ...withFeaturedProduct.featuredDeal };
            } else if (withFlashProduct?.flashDeal) {
                finalPrice = withFlashProduct.flashPrice;
                activeDeal = { type: 'flash', ...withFlashProduct.flashDeal };
            } else if (withSaleProduct?.salePrice) {
                finalPrice = withSaleProduct.salePrice;
                activeDeal = { type: 'clearance', ...withSaleProduct.clearanceSale };
            }

            return {
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
            };
        });
    }
}

export default new WishlistService();
