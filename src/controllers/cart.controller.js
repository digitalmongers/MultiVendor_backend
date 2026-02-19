import CartService from '../services/cart.service.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import { addToCartSchema, updateCartItemSchema, guestIdSchema } from '../validations/cart.validation.js';
import Logger from '../utils/logger.js';

class CartController {
    /**
     * Extract identifier (customer or guestId) from request
     */
    _getIdentifier(req) {
        if (req.customer) {
            return { customer: req.customer._id };
        }


        const guestId = req.headers['x-guest-id'] || req.query.guestId;

        if (!guestId) {
            throw new AppError('Guest ID required for unauthenticated requests', HTTP_STATUS.BAD_REQUEST);
        }

        // Validate UUID format
        const validation = guestIdSchema.safeParse(guestId);
        if (!validation.success) {
            throw new AppError('Invalid guest ID format. Must be a valid UUID.', HTTP_STATUS.BAD_REQUEST);
        }

        return { guestId };
    }

    /**
     * GET /api/v1/cart - Get cart
     */
    async getCart(req, res, next) {
        try {
            const identifier = this._getIdentifier(req);
            const cart = await CartService.getCart(identifier);

            res.status(HTTP_STATUS.OK).json({
                success: true,
                data: cart
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/cart - Add item to cart
     */
    async addToCart(req, res, next) {
        try {
            const identifier = this._getIdentifier(req);

            // Validate request body
            const validation = addToCartSchema.safeParse(req.body);
            if (!validation.success) {
                throw new AppError(
                    validation.error.errors[0].message,
                    HTTP_STATUS.BAD_REQUEST,
                    'VALIDATION_ERROR'
                );
            }

            const { productId, quantity, variation } = validation.data;

            const cart = await CartService.addToCart(identifier, productId, quantity, variation);

            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Item added to cart successfully',
                data: cart
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * PATCH /api/v1/cart/:itemId - Update item quantity
     */
    async updateItemQuantity(req, res, next) {
        try {
            const identifier = this._getIdentifier(req);
            const { itemId } = req.params;

            // Validate request body
            const validation = updateCartItemSchema.safeParse(req.body);
            if (!validation.success) {
                throw new AppError(
                    validation.error.errors[0].message,
                    HTTP_STATUS.BAD_REQUEST,
                    'VALIDATION_ERROR'
                );
            }

            const { quantity } = validation.data;

            const cart = await CartService.updateItemQuantity(identifier, itemId, quantity);

            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Cart item updated successfully',
                data: cart
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/v1/cart/:itemId - Remove item from cart
     */
    async removeItem(req, res, next) {
        try {
            const identifier = this._getIdentifier(req);
            const { itemId } = req.params;

            const cart = await CartService.removeItem(identifier, itemId);

            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Item removed from cart successfully',
                data: cart
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/v1/cart - Clear entire cart
     */
    async clearCart(req, res, next) {
        try {
            const identifier = this._getIdentifier(req);

            const cart = await CartService.clearCart(identifier);

            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Cart cleared successfully',
                data: cart
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new CartController();
