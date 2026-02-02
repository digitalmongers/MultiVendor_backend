import WishlistService from '../services/wishlist.service.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import { addToWishlistSchema } from '../validations/wishlist.validation.js';
import Logger from '../utils/logger.js';

class WishlistController {
    /**
     * GET /api/v1/wishlist - Get customer wishlist
     */
    async getWishlist(req, res, next) {
        try {
            const customerId = req.customer._id;
            const wishlist = await WishlistService.getWishlist(customerId);

            res.status(HTTP_STATUS.OK).json({
                success: true,
                data: wishlist
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/wishlist - Add product to wishlist
     */
    async addToWishlist(req, res, next) {
        try {
            const customerId = req.customer._id;

            // Validate request body
            const validation = addToWishlistSchema.safeParse(req.body);
            if (!validation.success) {
                throw new AppError(
                    validation.error.errors[0].message,
                    HTTP_STATUS.BAD_REQUEST,
                    'VALIDATION_ERROR'
                );
            }

            const { productId } = validation.data;

            const wishlist = await WishlistService.addToWishlist(customerId, productId);

            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Product added to wishlist successfully',
                data: wishlist
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/v1/wishlist/:productId - Remove product from wishlist
     */
    async removeFromWishlist(req, res, next) {
        try {
            const customerId = req.customer._id;
            const { productId } = req.params;

            // Validate productId format
            if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
                throw new AppError('Invalid product ID', HTTP_STATUS.BAD_REQUEST);
            }

            const wishlist = await WishlistService.removeFromWishlist(customerId, productId);

            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Product removed from wishlist successfully',
                data: wishlist
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/v1/wishlist/check/:productId - Check if product is in wishlist
     */
    async checkProduct(req, res, next) {
        try {
            const customerId = req.customer._id;
            const { productId } = req.params;

            // Validate productId format
            if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
                throw new AppError('Invalid product ID', HTTP_STATUS.BAD_REQUEST);
            }

            const result = await WishlistService.isInWishlist(customerId, productId);

            res.status(HTTP_STATUS.OK).json({
                success: true,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/v1/wishlist - Clear entire wishlist
     */
    async clearWishlist(req, res, next) {
        try {
            const customerId = req.customer._id;

            const wishlist = await WishlistService.clearWishlist(customerId);

            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Wishlist cleared successfully',
                data: wishlist
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new WishlistController();
