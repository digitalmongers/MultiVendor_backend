import CartRepository from '../repositories/cart.repository.js';
import ProductRepository from '../repositories/product.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Logger from '../utils/logger.js';
import ClearanceSaleService from './clearanceSale.service.js';
import FlashDealService from './flashDeal.service.js';
import FeaturedDealService from './featuredDeal.service.js';
import DealOfTheDayService from './dealOfTheDay.service.js';

class CartService {
    /**
     * Get cart for customer or guest
     */
    async getCart(identifier) {
        let cart;

        if (identifier.customer) {
            cart = await CartRepository.findByCustomer(identifier.customer);
        } else if (identifier.guestId) {
            cart = await CartRepository.findByGuestId(identifier.guestId);
        } else {
            throw new AppError('Customer ID or Guest ID required', HTTP_STATUS.BAD_REQUEST);
        }

        if (!cart) {
            return {
                items: [],
                totalItems: 0,
                subtotal: 0,
                message: 'Cart is empty'
            };
        }

        // Filter out inactive or deleted products
        cart.items = cart.items.filter(item =>
            item.product &&
            item.product.isActive === true &&
            item.product.status === 'approved'
        );

        // Enrich products with active deals
        const enrichedItems = await this.enrichCartItems(cart.items);

        // Calculate totals
        const subtotal = enrichedItems.reduce((sum, item) => {
            const price = item.finalPrice || item.product.price;
            return sum + (price * item.quantity);
        }, 0);

        const totalItems = enrichedItems.reduce((sum, item) => sum + item.quantity, 0);

        return {
            items: enrichedItems,
            totalItems,
            subtotal: parseFloat(subtotal.toFixed(2))
        };
    }

    /**
     * Add item to cart
     */
    async addToCart(identifier, productId, quantity = 1, variation = null) {
        // 1. Validate product exists and is available
        const product = await ProductRepository.findById(productId);

        if (!product) {
            throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }

        if (product.status !== 'approved' || !product.isActive) {
            throw new AppError('Product is not available for purchase', HTTP_STATUS.BAD_REQUEST, 'PRODUCT_UNAVAILABLE');
        }

        // 2. Stock validation
        if (variation) {
            // Check variation stock
            const variantData = product.variations?.find(v => v.sku === variation);
            if (!variantData || variantData.stock < quantity) {
                throw new AppError('Insufficient stock for selected variation', HTTP_STATUS.BAD_REQUEST, 'INSUFFICIENT_STOCK');
            }
        } else {
            // Check main product stock
            if (product.quantity < quantity) {
                throw new AppError('Insufficient stock', HTTP_STATUS.BAD_REQUEST, 'INSUFFICIENT_STOCK');
            }
        }

        // 3. Quantity limits
        if (quantity > 100) {
            throw new AppError('Maximum quantity per item is 100', HTTP_STATUS.BAD_REQUEST, 'QUANTITY_LIMIT_EXCEEDED');
        }

        // 4. Add to cart
        const cart = await CartRepository.addOrUpdateItem(identifier, productId, quantity, variation);

        Logger.info('Item added to cart', {
            identifier,
            productId,
            quantity,
            variation
        });

        return await this.getCart(identifier);
    }

    /**
     * Update cart item quantity
     */
    async updateItemQuantity(identifier, itemId, quantity) {
        if (quantity < 1) {
            throw new AppError('Quantity must be at least 1', HTTP_STATUS.BAD_REQUEST);
        }

        if (quantity > 100) {
            throw new AppError('Maximum quantity per item is 100', HTTP_STATUS.BAD_REQUEST);
        }

        // Get current cart to validate item exists
        const currentCart = identifier.customer
            ? await CartRepository.findByCustomer(identifier.customer)
            : await CartRepository.findByGuestId(identifier.guestId);

        if (!currentCart) {
            throw new AppError('Cart not found', HTTP_STATUS.NOT_FOUND);
        }

        const item = currentCart.items.find(i => i._id.toString() === itemId);
        if (!item) {
            throw new AppError('Item not found in cart', HTTP_STATUS.NOT_FOUND);
        }

        // Validate stock for new quantity
        const product = await ProductRepository.findById(item.product);
        if (!product) {
            throw new AppError('Product no longer available', HTTP_STATUS.NOT_FOUND);
        }

        if (item.variation) {
            const variantData = product.variations?.find(v => v.sku === item.variation);
            if (!variantData || variantData.stock < quantity) {
                throw new AppError('Insufficient stock for selected variation', HTTP_STATUS.BAD_REQUEST);
            }
        } else {
            if (product.quantity < quantity) {
                throw new AppError('Insufficient stock', HTTP_STATUS.BAD_REQUEST);
            }
        }

        await CartRepository.updateItemQuantity(identifier, itemId, quantity);

        Logger.info('Cart item quantity updated', {
            identifier,
            itemId,
            quantity
        });

        return await this.getCart(identifier);
    }

    /**
     * Remove item from cart
     */
    async removeItem(identifier, itemId) {
        await CartRepository.removeItem(identifier, itemId);

        Logger.info('Item removed from cart', {
            identifier,
            itemId
        });

        return await this.getCart(identifier);
    }

    /**
     * Clear entire cart
     */
    async clearCart(identifier) {
        await CartRepository.clearCart(identifier);

        Logger.info('Cart cleared', { identifier });

        return {
            items: [],
            totalItems: 0,
            subtotal: 0,
            message: 'Cart cleared successfully'
        };
    }

    /**
     * Merge guest cart to customer cart (called during login)
     */
    async mergeGuestCart(guestId, customerId, session = null) {
        if (!guestId) {
            return null;
        }

        return await CartRepository.mergeGuestToCustomer(guestId, customerId, session);
    }

    /**
     * Enrich cart items with active deals and calculate final prices
     * OPTIMIZED: Batch processing to prevent N+1 queries
     */
    async enrichCartItems(items) {
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
                _id: item._id,
                product: {
                    _id: product._id,
                    name: product.name,
                    slug: product.slug,
                    thumbnail: product.thumbnail,
                    price: product.price,
                    discount: product.discount,
                    discountType: product.discountType
                },
                variation: item.variation,
                quantity: item.quantity,
                basePrice: parseFloat(basePrice.toFixed(2)),
                finalPrice: parseFloat(finalPrice.toFixed(2)),
                activeDeal,
                subtotal: parseFloat((finalPrice * item.quantity).toFixed(2)),
                addedAt: item.addedAt
            };
        });
    }
}

export default new CartService();
