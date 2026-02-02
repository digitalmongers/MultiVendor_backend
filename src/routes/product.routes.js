import express from 'express';
import ProductController from '../controllers/product.controller.js';
import { protectVendor } from '../middleware/vendorAuth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { z } from 'zod';
import cacheMiddleware from '../middleware/cache.middleware.js';
import lockRequest from '../middleware/idempotency.middleware.js';

const router = express.Router();

/**
 * Validation Schemas (Zod)
 */
const variationSchema = z.object({
    attributeValues: z.record(z.string().min(1)), // { "Size": "L" }
    price: z.number().min(0.01, 'Variation price must be greater than 0'),
    sku: z.string().min(1, 'Variation SKU is required').max(100),
    stock: z.number().int().min(0, 'Stock must be zero or positive'),
    image: z.object({
        url: z.string().url().optional(),
        publicId: z.string().optional(),
    }).optional(),
});

const createProductSchema = z.object({
    body: z.object({
        name: z.string().min(3, 'Name must be at least 3 characters').max(200, 'Name cannot exceed 200 characters'),
        description: z.string().min(10, 'Description must be at least 10 characters').max(5000, 'Description too long'),
        category: z.string().min(24, 'Valid category ID is required').max(24),
        subCategory: z.string().min(24).max(24).optional(),
        productType: z.enum(['physical', 'digital']).default('physical'),
        unit: z.string().min(1, 'Unit is required'),
        price: z.number().min(0.01, 'Price must be greater than 0'),
        purchasePrice: z.number().min(0).optional(),
        tax: z.number().min(0).max(100).optional(),
        taxType: z.enum(['percent', 'flat']).optional(),
        discount: z.number().min(0).optional(),
        discountType: z.enum(['percent', 'flat']).optional(),
        shippingCost: z.number().min(0).optional(),
        multiplyShippingCost: z.boolean().optional(),
        quantity: z.number().int().min(0, 'Quantity must be zero or positive'),
        sku: z.string().min(1, 'SKU is required').max(100, 'SKU too long'),
        brand: z.string().max(100).optional(),
        searchTags: z.array(z.string().max(50, 'max 50 characters allowed')).optional(), // Unlimited tags allowed
        colors: z.array(z.string().max(50, 'max 50 characters allowed')).max(20, 'Maximum 20 colors allowed').optional(),
        attributes: z.array(z.object({
            attribute: z.string().min(24).max(24, 'Invalid attribute ID'),
            values: z.array(z.string().min(1).max(100, 'max 100 characters allowed')).min(1, 'At least one value required'),
        })).optional(),
        variations: z.array(variationSchema).max(100, 'Maximum 100 variations allowed').optional(),
        images: z.array(z.object({
            url: z.string().url('Invalid image URL'),
            publicId: z.string().min(1, 'Image publicId is required')
        })).min(1, 'At least one image is required').max(10, 'Maximum 10 images allowed'),
        thumbnail: z.object({
            url: z.string().url('Invalid thumbnail URL'),
            publicId: z.string().min(1, 'Thumbnail publicId is required')
        }),
        videoLink: z.string().url('Invalid video URL').optional(),
        seo: z.object({
            metaTitle: z.string().max(200).optional(),
            metaDescription: z.string().max(500).optional(),
            metaImage: z.string().url().optional(),
        }).optional(),
    }),
});

const updateProductSchema = z.object({
    body: z.object({
        name: z.string().min(3).max(200).optional(),
        description: z.string().min(10).max(5000).optional(),
        category: z.string().min(24).max(24).optional(),
        subCategory: z.string().min(24).max(24).optional(),
        price: z.number().min(0.01).optional(),
        quantity: z.number().int().min(0).optional(),
        discount: z.number().min(0).optional(),
        discountType: z.enum(['percent', 'flat']).optional(),
        tax: z.number().min(0).max(100).optional(),
        taxType: z.enum(['percent', 'flat']).optional(),
        shippingCost: z.number().min(0).optional(),
        multiplyShippingCost: z.boolean().optional(),
        isActive: z.boolean().optional(), // Vendor can toggle this
        searchTags: z.array(z.string().max(50)).optional(),
        colors: z.array(z.string().max(50)).max(20).optional(),
        images: z.array(z.object({
            url: z.string().url(),
            publicId: z.string().min(1),
        })).min(1).max(10).optional(),
        thumbnail: z.object({
            url: z.string().url(),
            publicId: z.string().min(1),
        }).optional(),
        videoLink: z.string().url().optional(),
        variations: z.array(variationSchema).max(100).optional(),
    }),
});

const restockProductSchema = z.object({
    body: z.object({
        quantity: z.number().int().min(1, 'Restock quantity must be at least 1').optional(),
        variations: z.array(z.object({
            sku: z.string().min(1, 'Variation SKU is required'),
            stock: z.number().int().min(1, 'Restock quantity must be at least 1')
        })).optional()
    }).refine(data => data.quantity || (data.variations && data.variations.length > 0), {
        message: "Either quantity or variations stock update is required",
        path: ["quantity"]
    })
});

/**
 * Public Routes
 */
// Optimized Search API for Search Bar (Autocomplete)
router.get('/public/search', cacheMiddleware(60), ProductController.searchProducts); // 1 min cache for fresh results

router.get('/public', cacheMiddleware(300), ProductController.getAllPublicProducts); // 5 min cache for sorting/filtering
router.get('/public/:id', cacheMiddleware(300), ProductController.getPublicProductById);
router.get('/public/:id/similar', cacheMiddleware(600), ProductController.getSimilarProducts); // 10 min cache for similar products
router.get('/public/featured/list', cacheMiddleware(600), ProductController.getFeaturedProducts); // 10 min cache for featured products

/**
 * Vendor Routes (Protected)
 */
router.use(protectVendor);

router.post(
    '/',
    lockRequest('create_product'),
    validate(createProductSchema),
    ProductController.createProduct
);

// Vendor Limited Stock Products (Must be before generic /:id routes if any, though currently /:id is further down)
router.get('/limit-stock', ProductController.getLimitedStockProducts);

router.get('/', ProductController.getVendorProducts);

// Vendor Product Statistics
router.get('/stats/dashboard', ProductController.getVendorProductStats);

// Vendor Export Products
router.get('/export/csv', ProductController.exportVendorProducts);

// --- Bulk Import Routes ---
import { uploadExcel } from '../utils/multer.js';

// Download Bulk Import Template
router.get('/bulk-import/template', ProductController.downloadBulkImportTemplate);

// Upload Bulk Import Excel
router.post(
    '/bulk-import',
    lockRequest('bulk_product_import'),
    uploadExcel.single('file'),
    ProductController.bulkImportProducts
);

router.patch(
    '/:id',
    lockRequest('update_product'),
    validate(updateProductSchema),
    ProductController.updateProduct
);

router.patch(
    '/:id/restock',
    lockRequest('restock_product'),
    validate(restockProductSchema),
    ProductController.restockProduct
);

router.delete(
    '/:id',
    lockRequest('delete_product'),
    ProductController.deleteProduct
);

/**
 * Admin Routes (Helpers)
 * Usually mounted separately or protected here.
 * Since v1.routes.js mounts this at /products, we can add sensitive routes here if protected.
 */
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import { SYSTEM_PERMISSIONS } from '../constants.js';

const adminRouter = express.Router(); // Sub-router or just attach to main router with check

// Admin Bulk Import Template
router.get(
    '/admin/bulk-import/template',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    ProductController.downloadBulkImportTemplate
);

// Admin Bulk Import
router.post(
    '/admin/bulk-import',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    lockRequest('admin_bulk_import'),
    uploadExcel.single('file'),
    ProductController.adminBulkImportProducts
);

// Admin Create Product (No Approval Needed)
router.post(
    '/admin/create',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    lockRequest('admin_create_product'),
    validate(createProductSchema),
    ProductController.adminCreateProduct
);

// Admin List In-House Products
router.get(
    '/admin/in-house',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    ProductController.getAdminInHouseProducts
);

// Admin Limited Stock Products
router.get(
    '/admin/limit-stock',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    ProductController.getAdminLimitedStockProducts
);

// Admin Restock Product
router.patch(
    '/admin/:id/restock',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    lockRequest('admin_restock_product'),
    validate(restockProductSchema),
    ProductController.adminRestockProduct
);

// Admin List All Products
router.get(
    '/admin/all',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    ProductController.adminGetAllProducts
);

// Admin Export Products
router.get(
    '/admin/export/csv',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    ProductController.exportAdminProducts
);

// Admin Product Statistics
router.get(
    '/admin/stats/dashboard',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    ProductController.getAdminProductStats
);

// Admin Get Single Product
router.get(
    '/admin/:id',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    ProductController.adminGetProductById
);

// Admin Status Update (Approve/Reject)
router.patch(
    '/admin/:id/status',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    lockRequest('admin_product_status'),
    validate(z.object({
        body: z.object({
            status: z.enum(['pending', 'approved', 'rejected', 'suspended']),
            reason: z.string().optional() // Required if rejected (enforced in service)
        })
    })),
    ProductController.adminUpdateStatus
);

// Admin Full Edit (PUT)
router.put(
    '/admin/:id',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    lockRequest('admin_product_edit'),
    validate(createProductSchema), // Requires full payload
    ProductController.adminUpdateProduct
);

// Admin Partial Edit (PATCH)
router.patch(
    '/admin/:id',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    lockRequest('admin_product_edit_partial'),
    validate(updateProductSchema), // Allows partial payload
    ProductController.adminUpdateProduct
);

// Admin Delete Product
router.delete(
    '/admin/:id',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    lockRequest('admin_product_delete'),
    ProductController.adminDeleteProduct
);

// Admin Toggle Featured Status
router.patch(
    '/admin/:id/featured',
    authorizeStaff(SYSTEM_PERMISSIONS.PRODUCT_MANAGEMENT),
    validate(z.object({
        body: z.object({
            isFeatured: z.boolean()
        })
    })),
    ProductController.adminToggleFeatured
);

export default router;
