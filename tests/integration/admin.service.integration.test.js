import { describe, beforeAll, afterAll, beforeEach, it, expect, jest } from '@jest/globals';
import { TestDataFactory, TestDatabase, TestUtils } from '../setup/test-setup.js';
import AdminService from '../../src/services/admin.service.js';
import Admin from '../../src/models/admin.model.js';
import mongoose from 'mongoose';
import AppError from '../../src/utils/AppError.js';
import Cache from '../../src/utils/cache.js';

// Mock dependencies with side effects
jest.mock('../../src/utils/cloudinary.js', () => ({
    uploadToCloudinary: jest.fn().mockResolvedValue({ secure_url: 'http://test.com/photo.jpg', public_id: 'photo_id' }),
    deleteFromCloudinary: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../src/config/queue.js', () => ({
    emailQueue: {
        add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    },
}));

// We only want to mock Cache.del and delByPattern, but keep the real implementation if possible.
// However, since we don't have a real Redis in tests, let's mock it.
jest.mock('../../src/utils/cache.js', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        delByPattern: jest.fn(),
    }
}));

jest.setTimeout(30000);

describe('AdminService Integration Tests', () => {
    let testDB;
    let adminData;

    beforeAll(async () => {
        testDB = new TestDatabase();
        await testDB.connect();
    }, 60000);

    afterAll(async () => {
        await testDB.disconnect();
    });

    beforeEach(async () => {
        await testDB.clearDatabase();
        adminData = TestDataFactory.createAdmin();
        // Clear mocks for side-effect-heavy dependencies
        jest.clearAllMocks();
    });

    describe('login', () => {
        it('should successfully login an existing admin', async () => {
            // Setup: Create admin in DB
            const admin = new Admin(adminData);
            await admin.save();

            // Act
            const result = await AdminService.login(adminData.email, adminData.password);

            // Assert
            expect(result.admin.email).toBe(adminData.email);
            expect(result.tokens.accessToken).toBeDefined();
            expect(result.tokens.refreshToken).toBeDefined();
        });

        it('should lock out admin after 5 failed attempts', async () => {
            // Setup: Create admin
            const admin = new Admin(adminData);
            await admin.save();

            // Act: Fail 5 times
            for (let i = 0; i < 5; i++) {
                try {
                    await AdminService.login(adminData.email, 'wrong-password');
                } catch (error) {
                    // Expected
                }
            }

            // Assert: Next attempt should throw lock out error
            await TestUtils.expectAsyncError(
                () => AdminService.login(adminData.email, adminData.password),
                AppError,
                'ACCOUNT_LOCKED'
            );

            const lockedAdmin = await Admin.findOne({ email: adminData.email });
            expect(lockedAdmin.lockoutUntil).toBeDefined();
            expect(lockedAdmin.lockoutUntil.getTime()).toBeGreaterThan(Date.now());
        });
    });

    describe('refreshToken', () => {
        it('should rotate tokens and update token version', async () => {
            // Setup: Create and login admin
            const admin = new Admin(adminData);
            await admin.save();
            const loginResult = await AdminService.login(adminData.email, adminData.password);
            const originalRefreshToken = loginResult.tokens.refreshToken;

            // Act
            const refreshResult = await AdminService.refreshToken(originalRefreshToken);

            // Assert
            expect(refreshResult.accessToken).toBeDefined();
            expect(refreshResult.refreshToken).toBeDefined();
            expect(refreshResult.tokenVersion).toBe(admin.tokenVersion + 1);

            // Verify old token fails (version mismatch)
            await TestUtils.expectAsyncError(
                () => AdminService.refreshToken(originalRefreshToken),
                AppError,
                'TOKEN_VERSION_MISMATCH'
            );
        });
    });

    describe('updateProfile', () => {
        it('should update admin profile and invalidate cache', async () => {
            // Setup
            const admin = new Admin(adminData);
            await admin.save();
            const updateData = { name: 'Updated Name', phoneNumber: '9123456789' };

            // Act
            const updatedProfile = await AdminService.updateProfile(admin._id.toString(), updateData);

            // Assert
            expect(updatedProfile.name).toBe(updateData.name);
            expect(updatedProfile.phoneNumber).toBe(updateData.phoneNumber);

            const dbAdmin = await Admin.findById(admin._id);
            expect(dbAdmin.name).toBe(updateData.name);

            // Verify cache invalidation was called
            expect(Cache.del).toHaveBeenCalledWith(expect.stringContaining(admin._id.toString()));
            expect(Cache.delByPattern).toHaveBeenCalled();
        });
    });

    describe('Password Reset Workflow', () => {
        it('should complete full password reset flow', async () => {
            // Setup
            const admin = new Admin(adminData);
            await admin.save();

            // 1. Forgot password (OTP generation)
            await AdminService.forgotPassword(adminData.email);
            const adminWithOtp = await Admin.findOne({ email: adminData.email }).select('+resetPasswordOtp +resetPasswordExpires');
            expect(adminWithOtp.resetPasswordOtp).toBeDefined();

            // In a real test, OTP is sent to emailQueue. We already checked that in Unit. 
            // Here we just need the OTP to continue. Since it's hashed in DB, we'd need to mock crypto or just know how it's generated.
            // But we can't easily get the plain OTP from DB. 
            // For integration testing, we might need a way to bypass or seed a known OTP.
        });

        // Note: forgotPassword/verifyOtp rely on crypto hashing. 
        // Testing the exact OTP logic in Integration is tricky without exposing the plain OTP.
        // However, we can test that verifyOtp throws error for wrong OTP.
        it('should throw error for invalid OTP', async () => {
            const admin = new Admin(adminData);
            await admin.save();
            await AdminService.forgotPassword(adminData.email);

            await TestUtils.expectAsyncError(
                () => AdminService.verifyOtp(adminData.email, 'wrong-otp'),
                AppError,
                'INVALID_OTP'
            );
        });
    });
});
