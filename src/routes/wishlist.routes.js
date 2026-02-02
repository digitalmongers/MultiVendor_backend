import express from 'express';
import WishlistController from '../controllers/wishlist.controller.js';
import { protectCustomer } from '../middleware/customerAuth.middleware.js';

const router = express.Router();

/**
 * Wishlist Routes
 * All routes require customer authentication
 */

// Get wishlist
router.get('/', protectCustomer, WishlistController.getWishlist.bind(WishlistController));

// Add product to wishlist
router.post('/', protectCustomer, WishlistController.addToWishlist.bind(WishlistController));

// Check if product is in wishlist
router.get('/check/:productId', protectCustomer, WishlistController.checkProduct.bind(WishlistController));

// Remove product from wishlist
router.delete('/:productId', protectCustomer, WishlistController.removeFromWishlist.bind(WishlistController));

// Clear entire wishlist
router.delete('/', protectCustomer, WishlistController.clearWishlist.bind(WishlistController));

export default router;
