import express from 'express';
import CartController from '../controllers/cart.controller.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import lockRequest from '../middleware/idempotency.middleware.js';

const router = express.Router();

/**
 * Cart Routes
 * All routes support both guest (with x-guest-id header) and authenticated users
 */

// Get cart
router.get('/', optionalAuth, CartController.getCart.bind(CartController));

// Add item to cart - Locked to prevent double-add
router.post('/', optionalAuth, lockRequest('add_to_cart'), CartController.addToCart.bind(CartController));

// Update item quantity - Locked to prevent race conditions
router.patch('/:itemId', optionalAuth, lockRequest('update_cart_item'), CartController.updateItemQuantity.bind(CartController));

// Remove item from cart - Locked
router.delete('/:itemId', optionalAuth, lockRequest('remove_cart_item'), CartController.removeItem.bind(CartController));

// Clear entire cart - Locked
router.delete('/', optionalAuth, lockRequest('clear_cart'), CartController.clearCart.bind(CartController));

export default router;
