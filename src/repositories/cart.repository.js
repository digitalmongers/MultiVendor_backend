import Cart from '../models/cart.model.js';
import Logger from '../utils/logger.js';

class CartRepository {
    /**
     * Find cart by customer ID
     */
    async findByCustomer(customerId) {
        return await Cart.findOne({ customer: customerId })
            .populate({
                path: 'items.product',
                select: 'name slug price discount discountType thumbnail quantity isActive status'
            })
            .lean()
            .exec();
    }

    /**
     * Find cart by guest ID
     */
    async findByGuestId(guestId) {
        return await Cart.findOne({ guestId })
            .populate({
                path: 'items.product',
                select: 'name slug price discount discountType thumbnail quantity isActive status'
            })
            .lean()
            .exec();
    }

    /**
     * Create new cart
     */
    async create(cartData, options = {}) {
        const cart = new Cart(cartData);
        return await cart.save(options);
    }

    /**
     * Add item to cart or update quantity if exists
     */
    async addOrUpdateItem(identifier, productId, quantity, variation = null) {
        const filter = identifier.customer
            ? { customer: identifier.customer }
            : { guestId: identifier.guestId };

        // Check if item already exists
        const existingCart = await Cart.findOne({
            ...filter,
            'items.product': productId,
            'items.variation': variation
        });

        if (existingCart) {
            // Update existing item quantity
            return await Cart.findOneAndUpdate(
                {
                    ...filter,
                    'items.product': productId,
                    'items.variation': variation
                },
                {
                    $inc: { 'items.$.quantity': quantity }
                },
                { new: true }
            )
                .populate({
                    path: 'items.product',
                    select: 'name slug price discount discountType thumbnail quantity isActive status'
                })
                .exec();
        }

        // Add new item
        return await Cart.findOneAndUpdate(
            filter,
            {
                $push: {
                    items: {
                        product: productId,
                        variation,
                        quantity,
                        addedAt: new Date()
                    }
                }
            },
            { new: true, upsert: true }
        )
            .populate({
                path: 'items.product',
                select: 'name slug price discount discountType thumbnail quantity isActive status'
            })
            .exec();
    }

    /**
     * Update item quantity
     */
    async updateItemQuantity(identifier, itemId, quantity) {
        const filter = identifier.customer
            ? { customer: identifier.customer }
            : { guestId: identifier.guestId };

        return await Cart.findOneAndUpdate(
            {
                ...filter,
                'items._id': itemId
            },
            {
                $set: { 'items.$.quantity': quantity }
            },
            { new: true }
        )
            .populate({
                path: 'items.product',
                select: 'name slug price discount discountType thumbnail quantity isActive status'
            })
            .exec();
    }

    /**
     * Remove item from cart
     */
    async removeItem(identifier, itemId) {
        const filter = identifier.customer
            ? { customer: identifier.customer }
            : { guestId: identifier.guestId };

        return await Cart.findOneAndUpdate(
            filter,
            {
                $pull: { items: { _id: itemId } }
            },
            { new: true }
        )
            .populate({
                path: 'items.product',
                select: 'name slug price discount discountType thumbnail quantity isActive status'
            })
            .exec();
    }

    /**
     * Clear entire cart
     */
    async clearCart(identifier) {
        const filter = identifier.customer
            ? { customer: identifier.customer }
            : { guestId: identifier.guestId };

        return await Cart.findOneAndUpdate(
            filter,
            {
                $set: { items: [] }
            },
            { new: true }
        ).exec();
    }

    /**
     * Merge guest cart into customer cart (called on login)
     */
    async mergeGuestToCustomer(guestId, customerId, session = null) {
        const guestCart = await Cart.findOne({ guestId }).session(session);

        if (!guestCart || guestCart.items.length === 0) {
            Logger.info('No guest cart to merge', { guestId, customerId });
            return null;
        }

        const customerCart = await Cart.findOne({ customer: customerId }).session(session);

        if (!customerCart) {
            // No existing customer cart - convert guest cart to customer cart
            guestCart.customer = customerId;
            guestCart.guestId = null;
            guestCart.expiresAt = null;
            await guestCart.save({ session });

            Logger.info('Guest cart converted to customer cart', { guestId, customerId });
            return guestCart;
        }

        // Merge items from guest cart to customer cart
        for (const guestItem of guestCart.items) {
            const existingItemIndex = customerCart.items.findIndex(
                item =>
                    item.product.toString() === guestItem.product.toString() &&
                    item.variation === guestItem.variation
            );

            if (existingItemIndex >= 0) {
                // Merge quantities
                customerCart.items[existingItemIndex].quantity += guestItem.quantity;
            } else {
                // Add new item
                customerCart.items.push(guestItem);
            }
        }

        await customerCart.save({ session });

        // Delete guest cart
        await Cart.deleteOne({ guestId }).session(session);

        Logger.info('Guest cart merged and deleted', {
            guestId,
            customerId,
            mergedItems: guestCart.items.length
        });

        return customerCart;
    }

    /**
     * Apply coupon to cart
     */
    async applyCoupon(identifier, couponData) {
        const filter = identifier.customer
            ? { customer: identifier.customer }
            : { guestId: identifier.guestId };

        return await Cart.findOneAndUpdate(
            filter,
            { $set: { appliedCoupon: couponData } },
            { new: true }
        ).populate({
            path: 'items.product',
            select: 'name slug price discount discountType thumbnail quantity isActive status'
        }).exec();
    }

    /**
     * Remove coupon from cart
     */
    async removeCoupon(identifier) {
        const filter = identifier.customer
            ? { customer: identifier.customer }
            : { guestId: identifier.guestId };

        return await Cart.findOneAndUpdate(
            filter,
            { $unset: { appliedCoupon: "" } },
            { new: true }
        ).populate({
            path: 'items.product',
            select: 'name slug price discount discountType thumbnail quantity isActive status'
        }).exec();
    }

    /**
     * Delete cart
     */
    async deleteCart(identifier) {
        const filter = identifier.customer
            ? { customer: identifier.customer }
            : { guestId: identifier.guestId };

        return await Cart.deleteOne(filter).exec();
    }
}

export default new CartRepository();
