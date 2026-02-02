import Wishlist from '../models/wishlist.model.js';
import Logger from '../utils/logger.js';

class WishlistRepository {
    /**
     * Find wishlist by customer ID
     */
    async findByCustomer(customerId) {
        return await Wishlist.findOne({ customer: customerId })
            .populate({
                path: 'items.product',
                select: 'name slug price discount discountType thumbnail quantity isActive status vendor'
            })
            .lean()
            .exec();
    }

    /**
     * Add product to wishlist
     */
    async addProduct(customerId, productId) {
        return await Wishlist.findOneAndUpdate(
            { customer: customerId },
            {
                $addToSet: { // Prevents duplicates
                    items: {
                        product: productId,
                        addedAt: new Date()
                    }
                }
            },
            { new: true, upsert: true } // Create wishlist if doesn't exist
        )
            .populate({
                path: 'items.product',
                select: 'name slug price discount discountType thumbnail quantity isActive status vendor'
            })
            .exec();
    }

    /**
     * Remove product from wishlist
     */
    async removeProduct(customerId, productId) {
        return await Wishlist.findOneAndUpdate(
            { customer: customerId },
            {
                $pull: { items: { product: productId } }
            },
            { new: true }
        )
            .populate({
                path: 'items.product',
                select: 'name slug price discount discountType thumbnail quantity isActive status vendor'
            })
            .exec();
    }

    /**
     * Check if product is in wishlist
     */
    async isProductInWishlist(customerId, productId) {
        const wishlist = await Wishlist.findOne({
            customer: customerId,
            'items.product': productId
        }).lean().exec();

        return !!wishlist;
    }

    /**
     * Clear entire wishlist
     */
    async clearWishlist(customerId) {
        return await Wishlist.findOneAndUpdate(
            { customer: customerId },
            {
                $set: { items: [] }
            },
            { new: true }
        ).exec();
    }

    /**
     * Get wishlist item count
     */
    async getItemCount(customerId) {
        const wishlist = await Wishlist.findOne({ customer: customerId })
            .select('items')
            .lean()
            .exec();

        return wishlist ? wishlist.items.length : 0;
    }
}

export default new WishlistRepository();
