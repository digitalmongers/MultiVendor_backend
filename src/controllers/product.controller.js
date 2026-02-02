import ProductService from '../services/product.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import { convertToCSV, productCSVHeaders } from '../utils/csvExport.js';

class ProductController {
    createProduct = async (req, res) => {
        // Vendor ID from authenticated user (req.vendor)
        const product = await ProductService.createProduct(req.body, req.vendor._id);
        return res.status(HTTP_STATUS.CREATED).json(new ApiResponse(HTTP_STATUS.CREATED, product, SUCCESS_MESSAGES.CREATED));
    };



    getLimitedStockProducts = async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search;

        const filter = {};
        if (search) filter.search = search;

        // Service handles the low stock threshold filter internally
        const result = await ProductService.getLimitedStockProducts(req.vendor._id, { filter, page, limit });
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, SUCCESS_MESSAGES.FETCHED));
    };

    getVendorProducts = async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search;
        const status = req.query.status; // Filter by status (pending, approved, rejected, suspended)

        const filter = {};
        if (search) filter.search = search;
        if (status) filter.status = status;

        const result = await ProductService.getVendorProducts(req.vendor._id, { filter, page, limit });
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, SUCCESS_MESSAGES.FETCHED));
    };

    getVendorProductStats = async (req, res) => {
        const stats = await ProductService.getVendorProductStats(req.vendor._id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, stats, SUCCESS_MESSAGES.FETCHED));
    };

    getAllPublicProducts = async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        // Filter out unapproved products AND Out of Stock products (Enterprise Standard)
        const filter = {
            status: 'approved',
            isActive: true, // Only active products visible
            quantity: { $gt: 0 } // Only show products with at least 1 item in stock
        };

        if (req.query.search) {
            filter.search = req.query.search;
        }

        const result = await ProductService.getAllProducts({ filter, page, limit });
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, SUCCESS_MESSAGES.FETCHED));
    };

    searchProducts = async (req, res) => {
        const query = req.query.q || req.query.search || '';
        const limit = parseInt(req.query.limit) || 20;

        const products = await ProductService.searchProducts(query, limit);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, products, SUCCESS_MESSAGES.FETCHED));
    };

    getProductById = async (req, res) => {
        // Check if it's a public request or vendor request based on route or user
        // Ideally create separate method for clarity, but reusing route structure.
        // Since we have separate routes (public/:id), let's make a explicit public method.
        // But route calls getProductById. Let's redirect logic or split.
        const product = await ProductService.getProductById(req.params.id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, product, SUCCESS_MESSAGES.FETCHED));
    };

    getPublicProductById = async (req, res) => {
        const product = await ProductService.getPublicProductById(req.params.id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, product, SUCCESS_MESSAGES.FETCHED));
    };

    getSimilarProducts = async (req, res) => {
        const limit = parseInt(req.query.limit) || 10;
        const products = await ProductService.getSimilarProducts(req.params.id, limit);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, products, SUCCESS_MESSAGES.FETCHED));
    };

    updateProduct = async (req, res) => {
        const product = await ProductService.updateProduct(req.params.id, req.body, req.vendor._id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, product, SUCCESS_MESSAGES.UPDATED));
    };

    restockProduct = async (req, res) => {
        // req.body has quantity and/or variations
        const product = await ProductService.restockProduct(req.params.id, req.body, req.vendor._id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, product, 'Product restocked successfully'));
    };

    deleteProduct = async (req, res) => {
        await ProductService.deleteProduct(req.params.id, req.vendor._id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, SUCCESS_MESSAGES.DELETED));
    };

    // --- Bulk Import Methods ---

    downloadBulkImportTemplate = async (req, res) => {
        const { generateProductImportTemplate } = await import('../utils/excelTemplate.util.js');

        // Generate Excel template
        const excelBuffer = generateProductImportTemplate();

        // Set headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="product-bulk-import-template-${Date.now()}.xlsx"`);
        res.setHeader('Content-Length', excelBuffer.length);

        return res.send(excelBuffer);
    };

    bulkImportProducts = async (req, res) => {
        // Validate file upload
        if (!req.file) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(
                new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'No file uploaded. Please upload an Excel file.')
            );
        }

        // Validate file type
        const allowedMimeTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel' // .xls
        ];

        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(
                new ApiResponse(
                    HTTP_STATUS.BAD_REQUEST,
                    null,
                    'Invalid file type. Please upload an Excel file (.xlsx or .xls)'
                )
            );
        }

        // Validate file size (5MB limit)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (req.file.size > maxSize) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(
                new ApiResponse(
                    HTTP_STATUS.BAD_REQUEST,
                    null,
                    'File too large. Maximum file size is 5MB.'
                )
            );
        }

        // Process bulk import
        const result = await ProductService.bulkImportProducts(req.file.buffer, req.vendor._id);

        if (result.success) {
            return res.status(HTTP_STATUS.CREATED).json(
                new ApiResponse(
                    HTTP_STATUS.CREATED,
                    result,
                    result.message
                )
            );
        } else {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(
                new ApiResponse(
                    HTTP_STATUS.BAD_REQUEST,
                    result,
                    result.message
                )
            );
        }
    };

    // --- Admin Actions ---

    adminBulkImportProducts = async (req, res) => {
        // Validate file upload
        if (!req.file) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'No file uploaded. Please upload an Excel file.'));
        }

        const allowedMimeTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'Invalid file type. Please upload an Excel file (.xlsx or .xls)'));
        }

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (req.file.size > maxSize) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'File too large. Maximum file size is 5MB.'));
        }

        const result = await ProductService.adminBulkImportProducts(req.file.buffer);

        if (result.success) {
            return res.status(HTTP_STATUS.CREATED).json(new ApiResponse(HTTP_STATUS.CREATED, result, 'Admin bulk import completed successfully'));
        } else {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new ApiResponse(HTTP_STATUS.BAD_REQUEST, result, result.message));
        }
    };

    getAdminInHouseProducts = async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search;

        const filter = {};
        if (search) filter.search = search;

        const result = await ProductService.getAdminInHouseProducts({ filter, page, limit });
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, SUCCESS_MESSAGES.FETCHED));
    };

    getAdminLimitedStockProducts = async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search;

        const filter = {};
        if (search) filter.search = search;

        // Admin-specific limited stock view (In-House)
        const result = await ProductService.getAdminLimitedStockProducts({ filter, page, limit });
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, SUCCESS_MESSAGES.FETCHED));
    };

    adminRestockProduct = async (req, res) => {
        // Accepts same quantity/variations payload as vendor restock
        const product = await ProductService.adminRestockProduct(req.params.id, req.body);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, product, 'Product stock updated successfully'));
    };

    adminCreateProduct = async (req, res) => {
        const product = await ProductService.adminCreateProduct(req.body);
        return res.status(HTTP_STATUS.CREATED).json(new ApiResponse(HTTP_STATUS.CREATED, product, SUCCESS_MESSAGES.CREATED));
    };

    adminUpdateStatus = async (req, res) => {
        // status and reason in body
        const { status, reason } = req.body;
        const product = await ProductService.adminUpdateProductStatus(req.params.id, status, reason);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, product, 'Product status updated successfully'));
    };

    adminUpdateProduct = async (req, res) => {
        const product = await ProductService.adminUpdateProduct(req.params.id, req.body);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, product, SUCCESS_MESSAGES.UPDATED));
    };

    adminGetAllProducts = async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search;
        const status = req.query.status;
        const vendor = req.query.vendor;
        const category = req.query.category;

        const filter = {};
        if (search) filter.search = search;
        if (status) filter.status = status;
        if (vendor) filter.vendor = vendor;
        if (category) filter.category = category;

        const result = await ProductService.adminGetAllProducts({ filter, page, limit });
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, SUCCESS_MESSAGES.FETCHED));
    };

    adminGetProductById = async (req, res) => {
        const product = await ProductService.adminGetProductById(req.params.id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, product, SUCCESS_MESSAGES.FETCHED));
    };

    getAdminProductStats = async (req, res) => {
        const stats = await ProductService.getAdminProductStats();
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, stats, SUCCESS_MESSAGES.FETCHED));
    };

    adminDeleteProduct = async (req, res) => {
        await ProductService.adminDeleteProduct(req.params.id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, SUCCESS_MESSAGES.DELETED));
    };

    // --- Export Methods ---

    exportVendorProducts = async (req, res) => {
        const status = req.query.status;
        const search = req.query.search;

        const filter = {};
        if (status) filter.status = status;
        if (search) filter.search = search;

        const products = await ProductService.exportVendorProducts(req.vendor._id, filter);
        const csv = convertToCSV(products, productCSVHeaders);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="vendor-products-${Date.now()}.csv"`);
        return res.send(csv);
    };

    exportAdminProducts = async (req, res) => {
        const status = req.query.status;
        const vendor = req.query.vendor;
        const category = req.query.category;
        const search = req.query.search;

        const filter = {};
        if (status) filter.status = status;
        if (vendor) filter.vendor = vendor;
        if (category) filter.category = category;
        if (search) filter.search = search;

        const products = await ProductService.exportAdminProducts(filter);
        const csv = convertToCSV(products, productCSVHeaders);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="all-products-${Date.now()}.csv"`);
        return res.send(csv);
    };

    // --- Featured Products ---

    adminToggleFeatured = async (req, res) => {
        const { isFeatured } = req.body;
        const product = await ProductService.adminToggleFeatured(req.params.id, isFeatured);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, product, 'Featured status updated successfully'));
    };

    getFeaturedProducts = async (req, res) => {
        const limit = parseInt(req.query.limit) || 10;
        const products = await ProductService.getFeaturedProducts(limit);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, products, SUCCESS_MESSAGES.FETCHED));
    };
}

export default new ProductController();
