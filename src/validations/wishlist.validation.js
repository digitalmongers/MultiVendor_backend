import { z } from 'zod';

/**
 * Add to Wishlist Validation
 */
export const addToWishlistSchema = z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID')
});
