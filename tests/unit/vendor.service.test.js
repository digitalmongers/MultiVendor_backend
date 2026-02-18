import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import AppError from '../../src/utils/AppError.js';
import { TestDataFactory, TestUtils } from '../setup/test-setup.js';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../src/repositories/vendor.repository.js', () => ({
    __esModule: true,
    default: {
        findByEmail: jest.fn(),
        findById: jest.fn(),
        updateById: jest.fn(),
        create: jest.fn(),
        deleteById: jest.fn(),
    },
}));

jest.mock('../../src/models/vendor.model.js', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
        findById: jest.fn(),
        updateById: jest.fn(),
        create: jest.fn(),
        updateOne: jest.fn(),
        find: jest.fn(),
        countDocuments: jest.fn(),
        aggregate: jest.fn(),
    },
}));

jest.mock('../../src/models/product.model.js', () => ({
    __esModule: true,
    default: {
        countDocuments: jest.fn(),
        aggregate: jest.fn(),
        find: jest.fn(),
    },
}));

jest.mock('../../src/repositories/loginSetting.repository.js', () => ({
    __esModule: true,
    default: {
        getSettings: jest.fn(),
    },
}));

jest.mock('../../src/services/product.service.js', () => ({
    __esModule: true,
    default: {
        deleteVendorProducts: jest.fn(),
    },
}));

jest.mock('../../src/models/coupon.model.js', () => ({
    __esModule: true,
    default: {
        deleteMany: jest.fn(),
    },
}));

jest.mock('../../src/models/clearanceSale.model.js', () => ({
    __esModule: true,
    default: {
        deleteMany: jest.fn(),
    },
}));

jest.mock('../../src/utils/vendorCache.js', () => ({
    __esModule: true,
    default: {
        invalidateVendorCache: jest.fn(),
        invalidateAllVendorCaches: jest.fn(),
        getVendorDetail: jest.fn(),
        setVendorDetail: jest.fn(),
        getVendorList: jest.fn(),
        setVendorList: jest.fn(),
    },
}));

jest.mock('../../src/utils/audit.js', () => ({
    __esModule: true,
    default: {
        log: jest.fn(),
        security: jest.fn(),
    },
}));

jest.mock('../../src/utils/transaction.js', () => ({
    __esModule: true,
    default: {
        execute: jest.fn(),
        executeTransaction: jest.fn(),
    },
}));

jest.mock('../../src/config/queue.js', () => ({
    __esModule: true,
    emailQueue: {
        add: jest.fn(),
    },
}));

jest.mock('../../src/utils/cloudinary.js', () => ({
    __esModule: true,
    uploadToCloudinary: jest.fn(),
    deleteFromCloudinary: jest.fn(),
}));

jest.mock('../../src/utils/jwt.js', () => ({
    __esModule: true,
    generateToken: jest.fn(() => 'mock-token'),
    generateRefreshToken: jest.fn(() => 'mock-refresh'),
    verifyToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
}));

// Import after mocks
import VendorService from '../../src/services/vendor.service.js';
import VendorRepository from '../../src/repositories/vendor.repository.js';
import Vendor from '../../src/models/vendor.model.js';
import Product from '../../src/models/product.model.js';
import LoginSettingRepository from '../../src/repositories/loginSetting.repository.js';
import vendorCache from '../../src/utils/vendorCache.js';
import TransactionManager from '../../src/utils/transaction.js';
import { emailQueue } from '../../src/config/queue.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../src/utils/cloudinary.js';
import * as jwtUtils from '../../src/utils/jwt.js';

describe('VendorService', () => {
    let vendorData;
    let mockLoginSettings;

    beforeEach(() => {
        jest.clearAllMocks();
        vendorData = {
            email: 'vendor@test.com',
            firstName: 'John',
            lastName: 'Doe',
            businessName: 'Test Business',
            phoneNumber: '1234567890',
            password: 'Password123!',
        };

        mockLoginSettings = {
            maxLoginHit: 5,
            temporaryLoginBlockTime: 3600,
        };

        LoginSettingRepository.getSettings.mockResolvedValue(mockLoginSettings);
        emailQueue.add.mockResolvedValue({ id: 'job-123' });

        // Default mock for transaction
        TransactionManager.execute.mockImplementation(async (callback) => await callback('mock-session'));
        TransactionManager.executeTransaction.mockImplementation(async (callback) => await callback('mock-session'));
    });

    describe('signupStep1', () => {
        it('should successfully complete signup step 1', async () => {
            const mockVendor = { ...vendorData, _id: new mongoose.Types.ObjectId() };
            VendorRepository.findByEmail.mockResolvedValue(null);
            VendorRepository.create.mockResolvedValue(mockVendor);

            const result = await VendorService.signupStep1(vendorData);

            expect(VendorRepository.findByEmail).toHaveBeenCalledWith(vendorData.email);
            expect(VendorRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...vendorData,
                    registrationStep: 1
                }),
                { session: 'mock-session' }
            );
            expect(result).toHaveProperty('id');
            expect(result.message).toContain('Step 1 complete');
        });

        it('should throw conflict error if email exists', async () => {
            VendorRepository.findByEmail.mockResolvedValue({ _id: 'existing' });

            await TestUtils.expectAsyncError(
                () => VendorService.signupStep1(vendorData),
                AppError,
                'Email already registered'
            );
        });
    });

    describe('signupStep2', () => {
        it('should successfully complete signup step 2', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const step2Data = { businessAddress: '123 Street', businessTin: 'TIN123' };
            const mockVendor = { ...vendorData, _id: vendorId, registrationStep: 1 };

            VendorRepository.findById.mockResolvedValue(mockVendor);
            VendorRepository.updateById.mockResolvedValue({ ...mockVendor, ...step2Data, status: 'pending' });

            const result = await VendorService.signupStep2(vendorId, step2Data);

            expect(VendorRepository.updateById).toHaveBeenCalledWith(vendorId, expect.objectContaining({
                ...step2Data,
                registrationStep: 2
            }));
            expect(emailQueue.add).toHaveBeenCalled();
            expect(result.message).toContain('Awaiting admin approval');
        });

        it('should throw error if vendor not found for step 2', async () => {
            VendorRepository.findById.mockResolvedValue(null);

            await TestUtils.expectAsyncError(
                () => VendorService.signupStep2(new mongoose.Types.ObjectId(), {}),
                AppError,
                'Vendor account not found'
            );
        });
    });

    describe('login', () => {
        it('should login successfully', async () => {
            const mockVendor = {
                ...vendorData,
                _id: new mongoose.Types.ObjectId(),
                status: 'active',
                matchPassword: jest.fn().mockResolvedValue(true),
                role: 'vendor',
                tokenVersion: 1
            };

            Vendor.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockVendor)
            });
            Vendor.updateOne.mockResolvedValue({ nModified: 1 });
            VendorRepository.findById.mockResolvedValue(mockVendor);

            const result = await VendorService.login(vendorData.email, 'Password123!');

            expect(result.vendor.email).toBe(vendorData.email);
            expect(result).toHaveProperty('accessToken');
        });

        it('should throw error for invalid credentials', async () => {
            Vendor.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(null)
            });

            await TestUtils.expectAsyncError(
                () => VendorService.login('wrong@test.com', 'pass'),
                AppError,
                'incorrect'
            );
        });

        it('should throw error for pending account', async () => {
            const mockVendor = { status: 'pending' };
            Vendor.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockVendor)
            });

            await TestUtils.expectAsyncError(
                () => VendorService.login(vendorData.email, 'pass'),
                AppError,
                'pending admin approval'
            );
        });
    });

    describe('updateProfile', () => {
        it('should update profile successfully and invalidate cache', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const updateData = { businessName: 'New Name' };
            VendorRepository.updateById.mockResolvedValue({ _id: vendorId, ...updateData });

            const result = await VendorService.updateProfile(vendorId, updateData);

            expect(VendorRepository.updateById).toHaveBeenCalledWith(vendorId, updateData);
            expect(vendorCache.invalidateVendorCache).toHaveBeenCalledWith(vendorId);
            expect(result.message).toContain('updated successfully');
        });
    });

    describe('updateImage', () => {
        it('should update image successfully', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const mockVendor = { _id: vendorId, photo: { publicId: 'old' } };
            const mockFile = { path: 'new/path' };
            const uploadResult = { secure_url: 'new-url', public_id: 'new-id' };

            VendorRepository.findById.mockResolvedValue(mockVendor);
            deleteFromCloudinary.mockResolvedValue({});
            uploadToCloudinary.mockResolvedValue(uploadResult);
            VendorRepository.updateById.mockResolvedValue({ ...mockVendor, photo: { url: 'new-url', publicId: 'new-id' } });

            const result = await VendorService.updateImage(vendorId, mockFile, 'photo');

            expect(deleteFromCloudinary).toHaveBeenCalledWith('old');
            expect(uploadToCloudinary).toHaveBeenCalled();
            expect(vendorCache.invalidateVendorCache).toHaveBeenCalledWith(vendorId);
            expect(result.url).toBe('new-url');
        });
    });

    describe('adminCreateVendor', () => {
        it('should create vendor account by admin', async () => {
            const adminId = new mongoose.Types.ObjectId();
            const mockVendor = [{ ...vendorData, _id: new mongoose.Types.ObjectId(), status: 'active' }];

            VendorRepository.findByEmail.mockResolvedValue(null);
            Vendor.findOne.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(null)
                })
            });
            Vendor.create.mockResolvedValue(mockVendor);

            const result = await VendorService.adminCreateVendor(vendorData, adminId);

            expect(Vendor.create).toHaveBeenCalled();
            expect(vendorCache.invalidateAllVendorCaches).toHaveBeenCalled();
            expect(result.message).toContain('successfully');
        });
    });

    describe('updateStatus', () => {
        it('should update vendor status', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            VendorRepository.updateById.mockResolvedValue({ _id: vendorId, email: 'v@t.com', status: 'active' });

            const result = await VendorService.updateStatus(vendorId, 'active');

            expect(VendorRepository.updateById).toHaveBeenCalledWith(vendorId, { status: 'active' });
            expect(vendorCache.invalidateAllVendorCaches).toHaveBeenCalled();
            expect(result.message).toContain('activated successfully');
        });
    });

    describe('deleteVendor', () => {
        it('should perform cascade delete', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            VendorRepository.deleteById.mockResolvedValue({ _id: vendorId });

            const result = await VendorService.deleteVendor(vendorId);

            expect(VendorRepository.deleteById).toHaveBeenCalled();
            expect(vendorCache.invalidateAllVendorCaches).toHaveBeenCalled();
            expect(result.message).toContain('deleted successfully');
        });
    });

    describe('getVendorById', () => {
        it('should get vendor from cache if available', async () => {
            const vendorId = new mongoose.Types.ObjectId().toString();
            const cachedVendor = { id: vendorId, email: 'cached@v.com' };
            vendorCache.getVendorDetail.mockResolvedValue(cachedVendor);

            const result = await VendorService.getVendorById(vendorId);

            expect(result).toEqual(cachedVendor);
            expect(VendorRepository.findById).not.toHaveBeenCalled();
        });

        it('should fetch from repository on cache miss', async () => {
            const vendorId = new mongoose.Types.ObjectId();
            const mockVendor = { _id: vendorId, email: 'v@t.com' };
            vendorCache.getVendorDetail.mockResolvedValue(null);
            VendorRepository.findById.mockResolvedValue(mockVendor);
            Product.countDocuments.mockResolvedValue(5);

            const result = await VendorService.getVendorById(vendorId);

            expect(VendorRepository.findById).toHaveBeenCalled();
            expect(vendorCache.setVendorDetail).toHaveBeenCalled();
            expect(result.email).toBe('v@t.com');
        });
    });

    describe('getAllVendors', () => {
        it('should return paginated vendor list', async () => {
            vendorCache.getVendorList.mockResolvedValue(null);
            Vendor.find.mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    skip: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockReturnValue({
                                exec: jest.fn().mockResolvedValue([{ _id: '1' }])
                            })
                        })
                    })
                })
            });
            Vendor.countDocuments.mockReturnValue({
                exec: jest.fn().mockResolvedValue(1)
            });
            Product.aggregate.mockResolvedValue([]);

            const result = await VendorService.getAllVendors(1, 10);

            expect(result.vendors).toHaveLength(1);
            expect(result.pagination.totalVendors).toBe(1);
        });
    });
});
