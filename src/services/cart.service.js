import CartRepository from '../repositories/cart.repository.js';
import ProductRepository from '../repositories/product.repository.js';
import CouponRepository from '../repositories/coupon.repository.js';
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
    /**
     * Get cart for customer or guest with full summary
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
                tax: 0,
                shipping: 0,
                discountTotal: 0,
                couponDiscount: 0,
                total: 0,
                message: 'Cart is empty'
            };
        }

        // Filter out inactive or deleted products
        cart.items = cart.items.filter(item =>
            item.product &&
            item.product.isActive === true &&
            item.product.status === 'approved'
        );

        // Enrich products and calculate totals
        const { items: enrichedItems, summary } = await this.enrichCartItems(cart.items, cart.appliedCoupon);

        return {
            items: enrichedItems,
            ...summary,
            appliedCoupon: cart.appliedCoupon ? {
                code: cart.appliedCoupon.code,
                discountAmount: cart.appliedCoupon.discountAmount,
                discountType: cart.appliedCoupon.discountType
            } : null
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
        await CartRepository.addOrUpdateItem(identifier, productId, quantity, variation);

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
            tax: 0,
            shipping: 0,
            discountTotal: 0,
            couponDiscount: 0,
            total: 0,
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
     * Apply Coupon
     */
    async applyCoupon(identifier, couponCode) {
        if (!couponCode) {
            throw new AppError('Coupon code is required', HTTP_STATUS.BAD_REQUEST);
        }

        // 1. Fetch Coupon
        const coupon = await CouponRepository.findByCode(couponCode);
        if (!coupon) {
            throw new AppError('Invalid coupon code', HTTP_STATUS.NOT_FOUND);
        }

        // 2. Validate Coupon
        const now = new Date();
        if (!coupon.isActive) {
            throw new AppError('Coupon is inactive', HTTP_STATUS.BAD_REQUEST);
        }
        if (now < new Date(coupon.startDate)) {
            throw new AppError('Coupon is not yet active', HTTP_STATUS.BAD_REQUEST);
        }
        if (now > new Date(coupon.expireDate)) {
            throw new AppError('Coupon has expired', HTTP_STATUS.BAD_REQUEST);
        }

        // 3. Get Cart to validate constraints
        const cart = identifier.customer
            ? await CartRepository.findByCustomer(identifier.customer)
            : await CartRepository.findByGuestId(identifier.guestId);

        if (!cart || cart.items.length === 0) {
            throw new AppError('Cart is empty', HTTP_STATUS.BAD_REQUEST);
        }

        // 4. Validate Coupon against Cart Items (Vendor Match)
        const couponVendorId = coupon.vendor ? coupon.vendor.toString() : null;
        let hasEligibleItem = false;

        // Helper to get vendor ID safely
        const getVendorId = (item) => {
            if (item.product && item.product.vendor) {
                return item.product.vendor._id ? item.product.vendor._id.toString() : item.product.vendor.toString();
            }
            return null;
        };

        for (const item of cart.items) {
            const itemVendorId = getVendorId(item);
            if (itemVendorId && couponVendorId && itemVendorId === couponVendorId) {
                hasEligibleItem = true;
                break;
            }
        }

        if (!hasEligibleItem) {
            throw new AppError('Coupon is not applicable to any items in your cart', HTTP_STATUS.BAD_REQUEST);
        }

        // 5. Update Cart with Coupon details
        // Check if user has already used this coupon (if limit applies)
        // Note: usage tracking is typically done at checkout, but we can check past orders here if needed.
        // For now, we rely on checkout validation for strict usage limits.

        // 4. Update Cart with Coupon details
        // We actully store the coupon details in the cart to persist it
        const couponData = {
            code: coupon.code,
            discountAmount: coupon.discountAmount,
            discountType: coupon.discountType,
            minPurchase: coupon.minPurchase,
            type: coupon.type,
            startDate: coupon.startDate,
            expireDate: coupon.expireDate,
            isActive: coupon.isActive
        };

        await CartRepository.applyCoupon(identifier, couponData);

        return await this.getCart(identifier);
    }

    /**
     * Remove Coupon
     */
    async removeCoupon(identifier) {
        await CartRepository.removeCoupon(identifier);
        return await this.getCart(identifier);
    }


    /**
     * Enrich cart items and calculate totals
     */
    async enrichCartItems(items, appliedCoupon = null) {
        if (!items || items.length === 0) {
            return {
                items: [],
                summary: {
                    totalItems: 0,
                    subtotal: 0,
                    tax: 0,
                    shipping: 0,
                    discountTotal: 0,
                    couponDiscount: 0,
                    total: 0
                }
            };
        }

        // Extract all products at once
        const products = items.map(item => item.product);

        // Batch enrich all products in parallel
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

        // Create lookup maps
        const salesMap = new Map(withSales.map((p, i) => [products[i]._id.toString(), p]));
        const flashMap = new Map(withFlash.map((p, i) => [products[i]._id.toString(), p]));
        const featuredMap = new Map(withFeatured.map((p, i) => [products[i]._id.toString(), p]));
        const dailyMap = new Map(withDaily.map((p, i) => [products[i]._id.toString(), p]));

        let cartSubtotal = 0;
        let cartTotalDiscount = 0; // Sum of base discounts
        let cartTax = 0;
        let cartShipping = 0;

        const enrichedItemsResults = items.map((item, index) => {
            const product = item.product;
            const productId = product._id.toString();

            // Get enriched product data
            const withSaleProduct = salesMap.get(productId);
            const withFlashProduct = flashMap.get(productId);
            const withFeaturedProduct = featuredMap.get(productId);
            const withDailyProduct = dailyMap.get(productId);

            // Calculate Best Discount (Product vs Deals)
            const priceCalc = this.calculateItemPrice(
                item,
                product,
                withSaleProduct,
                withFlashProduct,
                withFeaturedProduct,
                withDailyProduct
            );

            cartSubtotal += priceCalc.subtotal; // Base Price * Quantity
            cartTotalDiscount += priceCalc.totalDiscount; // (Base Price - Final Price) * Quantity

            // Tax Calculation
            let itemTax = 0;
            if (product.tax) {
                if (product.taxType === 'flat') {
                    itemTax = product.tax * item.quantity;
                } else {
                    // Tax on Final Price (after base discount)
                    itemTax = (priceCalc.finalPrice * product.tax / 100) * item.quantity;
                }
            }
            cartTax += itemTax;

            // Shipping Calculation
            let itemShipping = 0;
            if (product.shippingCost) {
                if (product.multiplyShippingCost) {
                    itemShipping = product.shippingCost * item.quantity;
                } else {
                    itemShipping = product.shippingCost;
                }
            }
            cartShipping += itemShipping;

            return {
                ...priceCalc,
                tax: itemTax,
                shipping: itemShipping
            };
        });

        // Coupon Logic (Stacked on Subtotal - Base Discount)
        let couponDiscount = 0;
        let isFreeDelivery = false;

        if (appliedCoupon && appliedCoupon.isActive) {
            // Calculate eligible total (items matching the coupon's vendor)
            let eligibleTotal = 0;

            // Helper to get vendor ID safely
            const getVendorId = (item) => {
                if (item.product && item.product.vendor) {
                    return item.product.vendor._id ? item.product.vendor._id.toString() : item.product.vendor.toString();
                }
                return null; // Admin product or invalid
            };

            const couponVendorId = appliedCoupon.vendor ? appliedCoupon.vendor.toString() : null;

            enrichedItemsResults.forEach(item => {
                const itemVendorId = getVendorId(item);
                if (itemVendorId && couponVendorId && itemVendorId === couponVendorId) {
                    eligibleTotal += item.finalPrice * item.quantity;
                }
            });

            // Validate Min Purchase against ELIGIBLE total, not cart total
            if (eligibleTotal >= (appliedCoupon.minPurchase || 0)) {
                if (appliedCoupon.type === 'free_delivery') {
                    isFreeDelivery = true;
                    // In a multi-vendor setup, free delivery might only apply to that vendor's shipping
                    // However, we'll implement it as global shipping discount for this vendor's items or total cart depending on policy
                    // Simplified: if coupon is valid, shipping for eligible items becomes 0 or we give discount equal to their shipping

                    // For now, let's calculate the shipping cost for ELIGIBLE items specifically
                    let eligibleShipping = 0;
                    items.forEach((item, idx) => {
                        const itemVendorId = getVendorId(item);
                        if (itemVendorId && couponVendorId && itemVendorId === couponVendorId) {
                            eligibleShipping += enrichedItemsResults[idx].shipping;
                        }
                    });
                    couponDiscount = eligibleShipping;
                } else if (appliedCoupon.discountType === 'flat' || appliedCoupon.discountType === 'amount') {
                    couponDiscount = Math.min(appliedCoupon.discountAmount, eligibleTotal);
                } else if (appliedCoupon.discountType === 'percent') {
                    couponDiscount = (eligibleTotal * appliedCoupon.discountAmount) / 100;
                }
            }
        }

        // Final Total
        // Total = (Subtotal - ItemDiscounts) - CouponDiscount + Tax + Shipping
        const sellingPrice = cartSubtotal - cartTotalDiscount;

        let total = sellingPrice - couponDiscount + cartTax + cartShipping;
        total = Math.max(0, total);

        return {
            items: enrichedItemsResults,
            summary: {
                totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
                subtotal: parseFloat(cartSubtotal.toFixed(2)),
                tax: parseFloat(cartTax.toFixed(2)),
                shipping: parseFloat(cartShipping.toFixed(2)),
                productDiscount: parseFloat(cartTotalDiscount.toFixed(2)), // Renovated name for clarity
                couponDiscount: parseFloat(couponDiscount.toFixed(2)),
                total: parseFloat(total.toFixed(2)),
                isFreeDelivery
            }
        };
    }

    /**
     * Get only the cart summary without full item details
     */
    async getCartSummary(identifier) {
        const cart = await this.getCart(identifier);

        // Return only the essential summary data for fast frontend updates
        return {
            summary: {
                totalItems: cart.totalItems,
                subtotal: cart.subtotal,
                tax: cart.tax,
                shipping: cart.shipping,
                productDiscount: cart.productDiscount,
                couponDiscount: cart.couponDiscount,
                total: cart.total,
                isFreeDelivery: cart.isFreeDelivery
            },
            appliedCoupon: cart.appliedCoupon
        };
    }

    /**
     * Calculate Item Price Logic (Best Discount Selection)
     */
    calculateItemPrice(item, product, withSale, withFlash, withFeatured, withDaily) {
        const basePrice = product.price;
        const quantity = item.quantity;

        let bestPrice = basePrice;
        let activeDeal = null;

        // 1. Check Product Discount
        if (product.discount > 0) {
            let discounted = basePrice;
            if (product.discountType === 'flat') {
                discounted = basePrice - product.discount;
            } else {
                discounted = basePrice - (basePrice * product.discount / 100);
            }
            if (discounted < bestPrice) {
                bestPrice = discounted;
                activeDeal = { type: 'product', discount: product.discount };
            }
        }

        // 2. Check Clearance Sale
        if (withSale?.salePrice && withSale.salePrice < bestPrice) {
            bestPrice = withSale.salePrice;
            activeDeal = { type: 'clearance', ...withSale.clearanceSale };
        }

        // 3. Check Flash Deal
        if (withFlash?.flashPrice && withFlash.flashPrice < bestPrice) {
            bestPrice = withFlash.flashPrice;
            activeDeal = { type: 'flash', ...withFlash.flashDeal };
        }

        // 4. Check Featured Deal
        if (withFeatured?.featuredPrice && withFeatured.featuredPrice < bestPrice) {
            bestPrice = withFeatured.featuredPrice;
            activeDeal = { type: 'featured', ...withFeatured.featuredDeal };
        }

        // 5. Check Deal of the Day (Highest Priority if lowest price)
        if (withDaily?.dealPrice && withDaily.dealPrice < bestPrice) {
            bestPrice = withDaily.dealPrice;
            activeDeal = { type: 'daily', ...withDaily.dealOfTheDay };
        }

        bestPrice = Math.max(0, bestPrice);

        return {
            _id: item._id,
            product: {
                _id: product._id,
                name: product.name,
                slug: product.slug,
                thumbnail: product.thumbnail,
                price: product.price,
                // ... other fields
            },
            variation: item.variation,
            quantity: quantity,
            basePrice: parseFloat(basePrice.toFixed(2)),
            finalPrice: parseFloat(bestPrice.toFixed(2)),
            activeDeal,
            subtotal: parseFloat((basePrice * quantity).toFixed(2)),
            totalDiscount: parseFloat(((basePrice - bestPrice) * quantity).toFixed(2)),
            addedAt: item.addedAt
        };
    }

}

export default new CartService();
