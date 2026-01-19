import express from 'express';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import uploadRoutes from './upload.routes.js';
import adminRoutes from './admin.routes.js';
import contentRoutes from './content.routes.js';
import faqRoutes from './faq.routes.js';
import productCategoryRoutes from './productCategory.routes.js';
import productSubCategoryRoutes from './productSubCategory.routes.js';
import newsletterRoutes from './newsletter.routes.js';

const router = express.Router();

/**
 * V1 Route Entry Point
 * Centralizes all version 1 endpoints.
 */
router.use('/auth', authRoutes);
router.use('/admin/auth', adminRoutes);
router.use('/upload', uploadRoutes);
router.use('/content', contentRoutes);
router.use('/faqs', faqRoutes);
router.use('/categories', productCategoryRoutes);
router.use('/subcategories', productSubCategoryRoutes);
router.use('/newsletter', newsletterRoutes);

// Health check can also be versioned if needed, but usually kept root
router.use('/health', healthRoutes);

export default router;
