import { describe, beforeAll, beforeEach, expect, jest } from '@jest/globals';
import AppError from '../../src/utils/AppError.js';
import mongoose from 'mongoose';

// ─── Mock ALL Dependencies (must be before any dynamic imports) ──────────────
// The key principle: mock EVERY module that the service or its transitive
// dependencies import, to prevent Mongoose model resolution and OOM crashes.

// Helper: findOne returns chainable object with .select() and .lean()
const createChainableMock = (value) => ({
    select: jest.fn().mockReturnValue(value),
    lean: jest.fn().mockReturnValue(value),
});

const mockFindOne = jest.fn();

// ─── Repository Mocks ───────────────────────────────────────────────────────

jest.unstable_mockModule('../../src/repositories/product.repository.js', () => ({
    default: {
        findById: jest.fn(),
        findOne: mockFindOne,
        findAll: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        updateStatus: jest.fn(),
    },
}));

jest.unstable_mockModule('../../src/repositories/productCategory.repository.js', () => ({
    default: {
        findById: jest.fn(),
    },
}));

jest.unstable_mockModule('../../src/repositories/productSubCategory.repository.js', () => ({
    default: {
        findById: jest.fn(),
    },
}));

// Mock deal repositories (prevent Mongoose model loading)
jest.unstable_mockModule('../../src/repositories/clearanceSale.repository.js', () => ({
    default: { findByVendor: jest.fn(), model: { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) } },
}));
jest.unstable_mockModule('../../src/repositories/flashDeal.repository.js', () => ({
    default: { model: { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) } },
}));
jest.unstable_mockModule('../../src/repositories/featuredDeal.repository.js', () => ({
    default: { model: { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) } },
}));
jest.unstable_mockModule('../../src/repositories/dealOfTheDay.repository.js', () => ({
    default: { model: { find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) } },
}));

// ─── Utility Mocks ──────────────────────────────────────────────────────────

jest.unstable_mockModule('../../src/utils/cache.js', () => ({
    default: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        delByPattern: jest.fn(),
    },
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

jest.unstable_mockModule('../../src/utils/vendorCache.js', () => ({
    default: {
        invalidateAllVendorCaches: jest.fn(),
    },
}));

jest.unstable_mockModule('../../src/utils/multiLayerCache.js', () => ({
    default: {
        get: jest.fn(),
    },
}));

jest.unstable_mockModule('../../src/utils/l1Cache.js', () => ({
    default: {
        get: jest.fn(),
        set: jest.fn(),
        delByPattern: jest.fn(),
    },
}));

jest.unstable_mockModule('../../src/utils/imageUpload.util.js', () => ({
    deleteMultipleImages: jest.fn(),
    uploadImageFromUrl: jest.fn(),
    uploadMultipleImagesFromUrls: jest.fn(),
}));

// ─── Service Mocks (deal enrichment services) ───────────────────────────────

jest.unstable_mockModule('../../src/services/clearanceSale.service.js', () => ({
    default: { enrichProductsWithSales: jest.fn((p) => p) },
}));

jest.unstable_mockModule('../../src/services/flashDeal.service.js', () => ({
    default: { enrichProductsWithFlashDeals: jest.fn((p) => p) },
}));

jest.unstable_mockModule('../../src/services/featuredDeal.service.js', () => ({
    default: { enrichProductsWithFeaturedDeals: jest.fn((p) => p) },
}));

jest.unstable_mockModule('../../src/services/dealOfTheDay.service.js', () => ({
    default: { enrichProductsWithDailyDeals: jest.fn((p) => p) },
}));

// ─── Load Mocked Modules ────────────────────────────────────────────────────

const getMocks = async () => {
    const ProductService = (await import('../../src/services/product.service.js')).default;
    const ProductRepository = (await import('../../src/repositories/product.repository.js')).default;
    const ProductCategoryRepository = (await import('../../src/repositories/productCategory.repository.js')).default;
    const ProductSubCategoryRepository = (await import('../../src/repositories/productSubCategory.repository.js')).default;
    const { deleteMultipleImages } = await import('../../src/utils/imageUpload.util.js');

    return { ProductService, ProductRepository, ProductCategoryRepository, ProductSubCategoryRepository, deleteMultipleImages };
};

// ─── Test Data Helpers ──────────────────────────────────────────────────────

const createMockProduct = (overrides = {}) => {
    const id = new mongoose.Types.ObjectId();
    const vendorId = new mongoose.Types.ObjectId();
    return {
        _id: id,
        name: 'Test Product',
        slug: 'test-product',
        sku: 'SKU-001',
        price: 1000,
        discount: 0,
        discountType: 'flat',
        quantity: 50,
        category: { _id: new mongoose.Types.ObjectId(), name: 'Electronics' },
        subCategory: null,
        vendor: { _id: vendorId, businessName: 'Test Vendor', status: 'active' },
        status: 'approved',
        isActive: true,
        isFeatured: false,
        images: [{ url: 'http://img.com/1.jpg', publicId: 'img-1' }],
        thumbnail: { url: 'http://img.com/thumb.jpg', publicId: 'thumb-1' },
        variations: [],
        seo: {},
        searchTags: [],
        ...overrides,
    };
};

const createValidProductData = (overrides = {}) => ({
    name: 'New Product',
    sku: 'NEW-SKU-001',
    price: 500,
    discount: 0,
    discountType: 'flat',
    quantity: 20,
    category: new mongoose.Types.ObjectId().toString(),
    images: [{ url: 'http://img.com/1.jpg', publicId: 'img-1' }],
    thumbnail: { url: 'http://img.com/thumb.jpg', publicId: 'thumb-1' },
    ...overrides,
});

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('ProductService', () => {
    let ProductService;
    let ProductRepository;
    let ProductCategoryRepository;
    let ProductSubCategoryRepository;
    let deleteMultipleImages;

    beforeAll(async () => {
        const mocks = await getMocks();
        ProductService = mocks.ProductService;
        ProductRepository = mocks.ProductRepository;
        ProductCategoryRepository = mocks.ProductCategoryRepository;
        ProductSubCategoryRepository = mocks.ProductSubCategoryRepository;
        deleteMultipleImages = mocks.deleteMultipleImages;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        // Default: findOne returns chainable null (no existing product)
        mockFindOne.mockReturnValue(createChainableMock(null));
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // createProduct
    // ═══════════════════════════════════════════════════════════════════════════

    describe('createProduct', () => {
        const vendorId = new mongoose.Types.ObjectId().toString();

        it('should create a product successfully with valid data', async () => {
            const data = createValidProductData();
            const mockCategory = { _id: data.category, name: 'Electronics', status: 'active' };
            const createdProduct = { ...data, _id: new mongoose.Types.ObjectId(), slug: 'new-product', vendor: vendorId };

            ProductCategoryRepository.findById.mockResolvedValue(mockCategory);
            mockFindOne.mockReturnValue(createChainableMock(null));
            ProductRepository.create.mockResolvedValue(createdProduct);

            const result = await ProductService.createProduct(data, vendorId);

            expect(ProductCategoryRepository.findById).toHaveBeenCalledWith(data.category);
            expect(ProductRepository.create).toHaveBeenCalled();
            expect(result._id).toBeDefined();
        });

        it('should throw CATEGORY_NOT_FOUND when category does not exist', async () => {
            const data = createValidProductData();
            ProductCategoryRepository.findById.mockResolvedValue(null);

            try {
                await ProductService.createProduct(data, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('CATEGORY_NOT_FOUND');
            }
        });

        it('should throw CATEGORY_INACTIVE when category is not active', async () => {
            const data = createValidProductData();
            ProductCategoryRepository.findById.mockResolvedValue({ _id: data.category, status: 'inactive' });

            try {
                await ProductService.createProduct(data, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('CATEGORY_INACTIVE');
            }
        });

        it('should throw SUBCATEGORY_NOT_FOUND when subcategory does not exist', async () => {
            const subCatId = new mongoose.Types.ObjectId().toString();
            const data = createValidProductData({ subCategory: subCatId });
            ProductCategoryRepository.findById.mockResolvedValue({ _id: data.category, status: 'active' });
            ProductSubCategoryRepository.findById.mockResolvedValue(null);

            try {
                await ProductService.createProduct(data, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('SUBCATEGORY_NOT_FOUND');
            }
        });

        it('should throw SUBCATEGORY_MISMATCH when subcategory belongs to different category', async () => {
            const categoryId = new mongoose.Types.ObjectId().toString();
            const differentCategoryId = new mongoose.Types.ObjectId().toString();
            const subCatId = new mongoose.Types.ObjectId().toString();
            const data = createValidProductData({ category: categoryId, subCategory: subCatId });

            ProductCategoryRepository.findById.mockResolvedValue({ _id: categoryId, status: 'active' });
            ProductSubCategoryRepository.findById.mockResolvedValue({ _id: subCatId, category: differentCategoryId });

            try {
                await ProductService.createProduct(data, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('SUBCATEGORY_MISMATCH');
            }
        });

        it('should throw DUPLICATE_SKU when SKU already exists', async () => {
            const data = createValidProductData();
            ProductCategoryRepository.findById.mockResolvedValue({ _id: data.category, status: 'active' });
            mockFindOne.mockReturnValue(createChainableMock({ _id: 'existing-id' }));

            try {
                await ProductService.createProduct(data, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('DUPLICATE_SKU');
                expect(error.message).toContain(data.sku);
            }
        });

        it('should throw DUPLICATE_VARIATION_SKU when variation SKUs are duplicated within data', async () => {
            const data = createValidProductData({
                variations: [
                    { sku: 'VAR-1', stock: 10 },
                    { sku: 'VAR-1', stock: 5 },
                ],
            });
            ProductCategoryRepository.findById.mockResolvedValue({ _id: data.category, status: 'active' });
            mockFindOne
                .mockReturnValueOnce(createChainableMock(null))
                .mockReturnValue(createChainableMock(null));

            try {
                await ProductService.createProduct(data, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('DUPLICATE_VARIATION_SKU');
            }
        });

        it('should throw IMAGES_REQUIRED when no images provided', async () => {
            const data = createValidProductData({ images: [], variations: undefined });
            ProductCategoryRepository.findById.mockResolvedValue({ _id: data.category, status: 'active' });
            mockFindOne.mockReturnValue(createChainableMock(null));

            try {
                await ProductService.createProduct(data, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('IMAGES_REQUIRED');
            }
        });

        it('should throw THUMBNAIL_REQUIRED when no thumbnail provided', async () => {
            const data = createValidProductData({ thumbnail: null });
            ProductCategoryRepository.findById.mockResolvedValue({ _id: data.category, status: 'active' });
            mockFindOne.mockReturnValue(createChainableMock(null));

            try {
                await ProductService.createProduct(data, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('THUMBNAIL_REQUIRED');
            }
        });

        it('should throw INVALID_DISCOUNT when percent discount exceeds 100', async () => {
            const data = createValidProductData({ discount: 150, discountType: 'percent' });
            ProductCategoryRepository.findById.mockResolvedValue({ _id: data.category, status: 'active' });
            mockFindOne.mockReturnValue(createChainableMock(null));

            try {
                await ProductService.createProduct(data, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('INVALID_DISCOUNT');
            }
        });

        it('should throw INVALID_DISCOUNT when flat discount >= price', async () => {
            const data = createValidProductData({ price: 500, discount: 500, discountType: 'flat' });
            ProductCategoryRepository.findById.mockResolvedValue({ _id: data.category, status: 'active' });
            mockFindOne.mockReturnValue(createChainableMock(null));

            try {
                await ProductService.createProduct(data, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('INVALID_DISCOUNT');
            }
        });

        it('should calculate total quantity from variations', async () => {
            const data = createValidProductData({
                variations: [
                    { sku: 'VAR-A', stock: 10 },
                    { sku: 'VAR-B', stock: 20 },
                ],
            });
            ProductCategoryRepository.findById.mockResolvedValue({ _id: data.category, status: 'active' });
            mockFindOne.mockReturnValue(createChainableMock(null));
            ProductRepository.create.mockResolvedValue({ ...data, _id: new mongoose.Types.ObjectId() });

            await ProductService.createProduct(data, vendorId);

            const createArg = ProductRepository.create.mock.calls[0][0];
            expect(createArg.quantity).toBe(30);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // getProductById
    // ═══════════════════════════════════════════════════════════════════════════

    describe('getProductById', () => {
        it('should return product when found', async () => {
            const mockProduct = createMockProduct();
            ProductRepository.findById.mockResolvedValue(mockProduct);

            const result = await ProductService.getProductById(mockProduct._id);

            expect(result._id).toEqual(mockProduct._id);
            expect(ProductRepository.findById).toHaveBeenCalledWith(mockProduct._id);
        });

        it('should throw PRODUCT_NOT_FOUND when product does not exist', async () => {
            ProductRepository.findById.mockResolvedValue(null);

            try {
                await ProductService.getProductById('nonexistent-id');
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('PRODUCT_NOT_FOUND');
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // updateProduct (Vendor)
    // ═══════════════════════════════════════════════════════════════════════════

    describe('updateProduct', () => {
        it('should throw PRODUCT_NOT_FOUND when product does not exist', async () => {
            ProductRepository.findById.mockResolvedValue(null);

            try {
                await ProductService.updateProduct('fake-id', { name: 'Updated' }, 'vendor-1');
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('PRODUCT_NOT_FOUND');
            }
        });

        it('should throw FORBIDDEN_ACCESS when vendor does not own the product', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const otherVendorId = new mongoose.Types.ObjectId();
            const mockProduct = createMockProduct({ vendor: { _id: vendorId, businessName: 'V1', status: 'active' } });

            ProductRepository.findById.mockResolvedValue(mockProduct);

            try {
                await ProductService.updateProduct(mockProduct._id, { name: 'Hack' }, otherVendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('FORBIDDEN_ACCESS');
            }
        });

        it('should reset status to pending and deactivate on content update of approved product', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const mockProduct = createMockProduct({
                vendor: { _id: vendorId, businessName: 'V1', status: 'active' },
                status: 'approved',
                isActive: true,
            });
            const updateData = { name: 'Updated Name' };

            ProductRepository.findById.mockResolvedValue(mockProduct);
            ProductRepository.update.mockResolvedValue({ ...mockProduct, ...updateData, status: 'pending', isActive: false });

            await ProductService.updateProduct(mockProduct._id, updateData, vendorId);

            const updateArg = ProductRepository.update.mock.calls[0][1];
            expect(updateArg.status).toBe('pending');
            expect(updateArg.isActive).toBe(false);
        });

        it('should throw PRODUCT_NOT_APPROVED when trying to activate non-approved product', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const mockProduct = createMockProduct({
                vendor: { _id: vendorId, businessName: 'V1', status: 'active' },
                status: 'pending',
                isActive: false,
            });

            ProductRepository.findById.mockResolvedValue(mockProduct);

            try {
                await ProductService.updateProduct(mockProduct._id, { isActive: true }, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('PRODUCT_NOT_APPROVED');
            }
        });

        it('should throw INVALID_DISCOUNT when updating discount percent > 100', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const mockProduct = createMockProduct({
                vendor: { _id: vendorId, businessName: 'V1', status: 'active' },
                status: 'pending',
                discountType: 'percent',
            });

            ProductRepository.findById.mockResolvedValue(mockProduct);

            try {
                await ProductService.updateProduct(mockProduct._id, { discount: 120, discountType: 'percent' }, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('INVALID_DISCOUNT');
            }
        });

        it('should throw IMAGES_REQUIRED when updating images to empty array', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const mockProduct = createMockProduct({
                vendor: { _id: vendorId, businessName: 'V1', status: 'active' },
                status: 'pending',
            });

            ProductRepository.findById.mockResolvedValue(mockProduct);

            try {
                await ProductService.updateProduct(mockProduct._id, { images: [] }, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('IMAGES_REQUIRED');
            }
        });

        it('should delete old images from Cloudinary when images are updated', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const mockProduct = createMockProduct({
                vendor: { _id: vendorId, businessName: 'V1', status: 'active' },
                status: 'pending',
                images: [
                    { url: 'old1.jpg', publicId: 'old-img-1' },
                    { url: 'old2.jpg', publicId: 'old-img-2' },
                ],
            });
            const newImages = [{ url: 'new1.jpg', publicId: 'new-img-1' }];

            ProductRepository.findById.mockResolvedValue(mockProduct);
            ProductRepository.update.mockResolvedValue({ ...mockProduct, images: newImages });

            await ProductService.updateProduct(mockProduct._id, { images: newImages }, vendorId);

            expect(deleteMultipleImages).toHaveBeenCalledWith(['old-img-1', 'old-img-2']);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // deleteProduct (Vendor)
    // ═══════════════════════════════════════════════════════════════════════════

    describe('deleteProduct', () => {
        it('should throw PRODUCT_NOT_FOUND when product does not exist', async () => {
            ProductRepository.findById.mockResolvedValue(null);

            try {
                await ProductService.deleteProduct('fake-id', 'vendor-1');
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('PRODUCT_NOT_FOUND');
            }
        });

        it('should throw FORBIDDEN_ACCESS when vendor does not own the product', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const otherVendorId = new mongoose.Types.ObjectId();
            const mockProduct = createMockProduct({ vendor: { _id: vendorId, businessName: 'V1', status: 'active' } });

            ProductRepository.findById.mockResolvedValue(mockProduct);

            try {
                await ProductService.deleteProduct(mockProduct._id, otherVendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('FORBIDDEN_ACCESS');
            }
        });

        it('should delete product and cleanup images', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const mockProduct = createMockProduct({
                vendor: { _id: vendorId, businessName: 'V1', status: 'active' },
                thumbnail: { url: 'thumb.jpg', publicId: 'thumb-1' },
                images: [{ url: 'img1.jpg', publicId: 'img-1' }],
                variations: [{ sku: 'V1', stock: 5, image: { url: 'var.jpg', publicId: 'var-img-1' } }],
                seo: { metaImage: { url: 'seo.jpg', publicId: 'seo-img-1' } },
            });

            ProductRepository.findById.mockResolvedValue(mockProduct);
            ProductRepository.delete.mockResolvedValue(true);

            const result = await ProductService.deleteProduct(mockProduct._id, vendorId);

            expect(result).toBe(true);
            expect(ProductRepository.delete).toHaveBeenCalledWith(mockProduct._id);
            expect(deleteMultipleImages).toHaveBeenCalledWith(
                expect.arrayContaining(['thumb-1', 'img-1', 'var-img-1', 'seo-img-1'])
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // restockProduct (Vendor)
    // ═══════════════════════════════════════════════════════════════════════════

    describe('restockProduct', () => {
        it('should throw PRODUCT_NOT_FOUND when product does not exist', async () => {
            ProductRepository.findById.mockResolvedValue(null);

            try {
                await ProductService.restockProduct('fake-id', { quantity: 10 }, 'vendor-1');
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('PRODUCT_NOT_FOUND');
            }
        });

        it('should throw FORBIDDEN_ACCESS when vendor does not own the product', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const otherVendorId = new mongoose.Types.ObjectId();
            const mockProduct = createMockProduct({ vendor: { _id: vendorId } });

            ProductRepository.findById.mockResolvedValue(mockProduct);

            try {
                await ProductService.restockProduct(mockProduct._id, { quantity: 10 }, otherVendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('FORBIDDEN_ACCESS');
            }
        });

        it('should add quantity for simple product (no variations)', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const mockProduct = createMockProduct({
                vendor: { _id: vendorId },
                quantity: 50,
                variations: [],
            });

            ProductRepository.findById.mockResolvedValue(mockProduct);
            ProductRepository.update.mockResolvedValue({ ...mockProduct, quantity: 60 });

            await ProductService.restockProduct(mockProduct._id, { quantity: 10 }, vendorId);

            const updateCall = ProductRepository.update.mock.calls[0];
            expect(updateCall[1].quantity).toBe(60);
        });

        it('should throw VARIATIONS_REQUIRED when product has variations but restock data does not', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const mockProduct = createMockProduct({
                vendor: { _id: vendorId },
                variations: [{ sku: 'V1', stock: 5 }],
            });

            ProductRepository.findById.mockResolvedValue(mockProduct);

            try {
                await ProductService.restockProduct(mockProduct._id, { quantity: 10 }, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('VARIATIONS_REQUIRED');
            }
        });

        it('should throw NO_VARIATIONS when restock has variations but product does not', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const mockProduct = createMockProduct({
                vendor: { _id: vendorId },
                variations: [],
            });

            ProductRepository.findById.mockResolvedValue(mockProduct);

            try {
                await ProductService.restockProduct(mockProduct._id, { variations: [{ sku: 'V1', stock: 5 }] }, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('NO_VARIATIONS');
            }
        });

        it('should throw NO_UPDATES when no valid stock updates provided', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const mockProduct = createMockProduct({
                vendor: { _id: vendorId },
                variations: [],
            });

            ProductRepository.findById.mockResolvedValue(mockProduct);

            try {
                await ProductService.restockProduct(mockProduct._id, {}, vendorId);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('NO_UPDATES');
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // adminUpdateProductStatus
    // ═══════════════════════════════════════════════════════════════════════════

    describe('adminUpdateProductStatus', () => {
        it('should throw PRODUCT_NOT_FOUND when product does not exist', async () => {
            ProductRepository.findById.mockResolvedValue(null);

            try {
                await ProductService.adminUpdateProductStatus('fake-id', 'approved');
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('PRODUCT_NOT_FOUND');
            }
        });

        it('should approve product and clear rejection reason', async () => {
            const mockProduct = createMockProduct({ status: 'pending', rejectionReason: 'Old reason' });
            ProductRepository.findById.mockResolvedValue(mockProduct);
            ProductRepository.update.mockResolvedValue({ ...mockProduct, status: 'approved', rejectionReason: '' });

            await ProductService.adminUpdateProductStatus(mockProduct._id, 'approved');

            const updateCall = ProductRepository.update.mock.calls[0];
            expect(updateCall[1].status).toBe('approved');
            expect(updateCall[1].rejectionReason).toBe('');
        });

        it('should reject product with reason and force inactive', async () => {
            const mockProduct = createMockProduct({ status: 'approved', isActive: true });
            ProductRepository.findById.mockResolvedValue(mockProduct);
            ProductRepository.update.mockResolvedValue({ ...mockProduct, status: 'rejected', isActive: false });

            await ProductService.adminUpdateProductStatus(mockProduct._id, 'rejected', 'Low quality images');

            const updateCall = ProductRepository.update.mock.calls[0];
            expect(updateCall[1].status).toBe('rejected');
            expect(updateCall[1].isActive).toBe(false);
            expect(updateCall[1].rejectionReason).toBe('Low quality images');
        });

        it('should throw REASON_REQUIRED when rejecting without reason', async () => {
            const mockProduct = createMockProduct();
            ProductRepository.findById.mockResolvedValue(mockProduct);

            try {
                await ProductService.adminUpdateProductStatus(mockProduct._id, 'rejected');
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('REASON_REQUIRED');
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // adminToggleFeatured
    // ═══════════════════════════════════════════════════════════════════════════

    describe('adminToggleFeatured', () => {
        it('should throw PRODUCT_NOT_FOUND when product does not exist', async () => {
            ProductRepository.findById.mockResolvedValue(null);

            try {
                await ProductService.adminToggleFeatured('fake-id', true);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('PRODUCT_NOT_FOUND');
            }
        });

        it('should toggle featured status', async () => {
            const mockProduct = createMockProduct({ isFeatured: false });
            ProductRepository.findById.mockResolvedValue(mockProduct);
            ProductRepository.update.mockResolvedValue({ ...mockProduct, isFeatured: true });

            const result = await ProductService.adminToggleFeatured(mockProduct._id, true);

            expect(ProductRepository.update).toHaveBeenCalledWith(mockProduct._id, { isFeatured: true });
            expect(result.isFeatured).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // adminDeleteProduct
    // ═══════════════════════════════════════════════════════════════════════════

    describe('adminDeleteProduct', () => {
        it('should throw PRODUCT_NOT_FOUND when product does not exist', async () => {
            ProductRepository.findById.mockResolvedValue(null);

            try {
                await ProductService.adminDeleteProduct('fake-id');
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('PRODUCT_NOT_FOUND');
            }
        });

        it('should delete product and cleanup all images', async () => {
            const mockProduct = createMockProduct({
                thumbnail: { url: 'thumb.jpg', publicId: 'thumb-1' },
                images: [{ url: 'img1.jpg', publicId: 'img-1' }, { url: 'img2.jpg', publicId: 'img-2' }],
                variations: [],
                seo: { metaImage: { url: 'seo.jpg', publicId: 'seo-1' } },
            });

            ProductRepository.findById.mockResolvedValue(mockProduct);
            ProductRepository.delete.mockResolvedValue(true);

            const result = await ProductService.adminDeleteProduct(mockProduct._id);

            expect(result).toBe(true);
            expect(deleteMultipleImages).toHaveBeenCalledWith(
                expect.arrayContaining(['thumb-1', 'img-1', 'img-2', 'seo-1'])
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // adminGetProductById
    // ═══════════════════════════════════════════════════════════════════════════

    describe('adminGetProductById', () => {
        it('should return product when found', async () => {
            const mockProduct = createMockProduct();
            ProductRepository.findById.mockResolvedValue(mockProduct);

            const result = await ProductService.adminGetProductById(mockProduct._id);

            expect(result._id).toEqual(mockProduct._id);
        });

        it('should throw PRODUCT_NOT_FOUND when product does not exist', async () => {
            ProductRepository.findById.mockResolvedValue(null);

            try {
                await ProductService.adminGetProductById('nonexistent');
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('PRODUCT_NOT_FOUND');
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // searchProducts
    // ═══════════════════════════════════════════════════════════════════════════

    describe('searchProducts', () => {
        it('should return empty array for query shorter than 2 characters', async () => {
            const result = await ProductService.searchProducts('a');

            expect(result).toEqual([]);
            expect(ProductRepository.findAll).not.toHaveBeenCalled();
        });

        it('should return empty array for empty query', async () => {
            const result = await ProductService.searchProducts('');

            expect(result).toEqual([]);
        });

        it('should return mapped product results for valid query', async () => {
            const mockProducts = [
                createMockProduct({ name: 'iPhone 15', price: 99999, slug: 'iphone-15' }),
            ];

            ProductRepository.findAll.mockResolvedValue({
                products: mockProducts,
                pagination: { total: 1, page: 1, limit: 20, pages: 1 },
            });

            const result = await ProductService.searchProducts('iPhone');

            expect(ProductRepository.findAll).toHaveBeenCalled();
            expect(result[0]).toHaveProperty('_id');
            expect(result[0]).toHaveProperty('name');
            expect(result[0]).toHaveProperty('price');
            expect(result[0]).toHaveProperty('slug');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // searchVendorProducts
    // ═══════════════════════════════════════════════════════════════════════════

    describe('searchVendorProducts', () => {
        it('should return empty array for empty query', async () => {
            const result = await ProductService.searchVendorProducts('vendor-1', '');

            expect(result).toEqual([]);
            expect(ProductRepository.findAll).not.toHaveBeenCalled();
        });

        it('should return mapped results for valid query', async () => {
            const mockProducts = [createMockProduct()];
            ProductRepository.findAll.mockResolvedValue({
                products: mockProducts,
                pagination: { total: 1, page: 1, limit: 20, pages: 1 },
            });

            const result = await ProductService.searchVendorProducts('vendor-1', 'test', 10);

            expect(result[0]).toHaveProperty('_id');
            expect(result[0]).toHaveProperty('name');
            expect(result[0]).toHaveProperty('sku');
            expect(result[0]).toHaveProperty('quantity');
            expect(result[0]).toHaveProperty('status');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // getAdminProductStats
    // ═══════════════════════════════════════════════════════════════════════════

    describe('getAdminProductStats', () => {
        it('should return correct stats structure', async () => {
            ProductRepository.count
                .mockResolvedValueOnce(100)  // total
                .mockResolvedValueOnce(10)   // pending
                .mockResolvedValueOnce(70)   // approved
                .mockResolvedValueOnce(5)    // rejected
                .mockResolvedValueOnce(3)    // suspended
                .mockResolvedValueOnce(65)   // active
                .mockResolvedValueOnce(12)   // featured
                .mockResolvedValueOnce(8);   // outOfStock

            const result = await ProductService.getAdminProductStats();

            expect(result.total).toBe(100);
            expect(result.byStatus.pending).toBe(10);
            expect(result.byStatus.approved).toBe(70);
            expect(result.byStatus.rejected).toBe(5);
            expect(result.byStatus.suspended).toBe(3);
            expect(result.active).toBe(65);
            expect(result.featured).toBe(12);
            expect(result.outOfStock).toBe(8);
            expect(result.inStock).toBe(92); // 100 - 8
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // generateUniqueSlug
    // ═══════════════════════════════════════════════════════════════════════════

    describe('generateUniqueSlug', () => {
        it('should generate slug from product name', async () => {
            mockFindOne.mockReturnValue(createChainableMock(null));

            const slug = await ProductService.generateUniqueSlug('iPhone 15 Pro Max');

            expect(slug).toBe('iphone-15-pro-max');
        });

        it('should append counter for duplicate slugs', async () => {
            mockFindOne
                .mockReturnValueOnce(createChainableMock({ _id: 'existing' }))
                .mockReturnValueOnce(createChainableMock(null));

            const slug = await ProductService.generateUniqueSlug('iPhone');

            expect(slug).toBe('iphone-1');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // adminCreateProduct
    // ═══════════════════════════════════════════════════════════════════════════

    describe('adminCreateProduct', () => {
        it('should create product with status approved and no vendor', async () => {
            const data = createValidProductData();
            ProductCategoryRepository.findById.mockResolvedValue({ _id: data.category, status: 'active' });
            mockFindOne.mockReturnValue(createChainableMock(null));
            ProductRepository.create.mockResolvedValue({ ...data, _id: new mongoose.Types.ObjectId(), status: 'approved' });

            await ProductService.adminCreateProduct(data);

            const createArg = ProductRepository.create.mock.calls[0][0];
            expect(createArg.status).toBe('approved');
            expect(createArg.vendor).toBeUndefined();
        });

        it('should throw CATEGORY_NOT_FOUND for invalid category', async () => {
            const data = createValidProductData();
            ProductCategoryRepository.findById.mockResolvedValue(null);

            try {
                await ProductService.adminCreateProduct(data);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect(error.code).toBe('CATEGORY_NOT_FOUND');
            }
        });
    });
});
