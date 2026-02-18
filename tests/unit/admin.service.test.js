import { describe, beforeAll, beforeEach, expect, jest } from '@jest/globals';
import AppError from '../../src/utils/AppError.js';
import { TestDataFactory, TestUtils } from '../setup/test-setup.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// Mock dependencies
const mockAdminRepository = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  count: jest.fn(),
};

jest.mock('../../src/repositories/admin.repository.js', () => ({
  __esModule: true,
  default: mockAdminRepository,
}));

jest.mock('../../src/utils/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  logger: { // Also mock named export 'logger' just in case
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }
}));

jest.mock('../../src/utils/security.js', () => ({
  __esModule: true,
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
  generateOTP: jest.fn(),
}));

jest.mock('../../src/utils/audit.js', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    security: jest.fn(),
  },
}));

jest.mock('../../src/config/queue.js', () => ({
  __esModule: true,
  emailQueue: {
    add: jest.fn(),
  },
}));

// Helper to get mocked modules
const getMocks = async () => {
  const AdminService = (await import('../../src/services/admin.service.js')).default;
  const AdminRepository = (await import('../../src/repositories/admin.repository.js')).default;
  return { AdminService, AdminRepository };
};

describe('AdminService', () => {
  let AdminService;
  let AdminRepository;
  let adminData;

  beforeAll(async () => {
    const mocks = await getMocks();
    AdminService = mocks.AdminService;
    AdminRepository = mocks.AdminRepository;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    adminData = TestDataFactory.createAdmin();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      const mockAdmin = { ...adminData, _id: new mongoose.Types.ObjectId() };
      mockAdmin.matchPassword = jest.fn().mockResolvedValue(true);

      AdminRepository.findByEmail.mockResolvedValue(mockAdmin);
      AdminRepository.updateById.mockResolvedValue(mockAdmin);

      // Act
      const result = await AdminService.login(adminData.email, 'TestPassword123!');

      // Assert
      expect(AdminRepository.findByEmail).toHaveBeenCalledWith(adminData.email, true);
      expect(result).toHaveProperty('admin');
      expect(result).toHaveProperty('tokens');
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
    });

    it('should throw error for invalid credentials', async () => {
      // Arrange
      const mockAdmin = { ...adminData, matchPassword: jest.fn().mockResolvedValue(false) };
      AdminRepository.findByEmail.mockResolvedValue(mockAdmin);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => AdminService.login(adminData.email, 'wrongpassword'),
        AppError,
        'INVALID_ADMIN_AUTH'
      );
    });

    it('should throw error for non-existent admin', async () => {
      // Arrange
      AdminRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => AdminService.login('nonexistent@test.com', 'password'),
        AppError,
        'INVALID_ADMIN_AUTH'
      );
    });

    it('should lock account after 5 failed attempts', async () => {
      // Arrange
      const mockAdmin = {
        ...adminData,
        _id: new mongoose.Types.ObjectId(),
        loginAttempts: 4,
        matchPassword: jest.fn().mockResolvedValue(false)
      };

      AdminRepository.findByEmail.mockResolvedValue(mockAdmin);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => AdminService.login(adminData.email, 'wrongpassword'),
        AppError,
        'ACCOUNT_LOCKED'
      );

      expect(AdminRepository.updateById).toHaveBeenCalledWith(
        mockAdmin._id,
        expect.objectContaining({
          loginAttempts: 0,
          lockoutUntil: expect.any(Number)
        })
      );
    });

    it('should handle remember me option correctly', async () => {
      // Arrange
      const mockAdmin = { ...adminData, _id: new mongoose.Types.ObjectId() };
      mockAdmin.matchPassword = jest.fn().mockResolvedValue(true);

      AdminRepository.findByEmail.mockResolvedValue(mockAdmin);
      AdminRepository.updateById.mockResolvedValue(mockAdmin);

      // Act
      const result = await AdminService.login(adminData.email, 'TestPassword123!', true);

      // Assert
      expect(result.tokens.refreshToken).toBeDefined();
      // Remember me should be reflected in token expiration
    });
  });

  describe('refreshToken', () => {
    let validRefreshToken;
    let mockAdmin;

    beforeEach(() => {
      mockAdmin = {
        ...adminData,
        _id: new mongoose.Types.ObjectId(),
        tokenVersion: 1
      };

      validRefreshToken = TestUtils.generateJWT(mockAdmin._id, 'test-refresh-secret', '30d');

      AdminRepository.findById.mockResolvedValue(mockAdmin);
      AdminRepository.updateById.mockResolvedValue(mockAdmin);
    });

    it('should refresh tokens with valid refresh token', async () => {
      // Arrange
      jest.spyOn(jwt, 'verify').mockReturnValue({
        id: mockAdmin._id,
        version: mockAdmin.tokenVersion
      });

      // Act
      const result = await AdminService.refreshToken(validRefreshToken);

      // Assert
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('tokenVersion');
      expect(result.tokenVersion).toBe(mockAdmin.tokenVersion + 1);
    });

    it('should throw error for invalid refresh token', async () => {
      // Arrange
      const jwtError = new Error('invalid signature');
      jwtError.name = 'JsonWebTokenError';
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw jwtError;
      });

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => AdminService.refreshToken('invalid-token'),
        AppError,
        'INVALID_TOKEN'
      );
    });

    it('should throw error for expired refresh token', async () => {
      // Arrange
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => AdminService.refreshToken('expired-token'),
        AppError,
        'TOKEN_EXPIRED'
      );
    });

    it('should throw error for token version mismatch', async () => {
      // Arrange

      jest.spyOn(jwt, 'verify').mockReturnValue({
        id: mockAdmin._id,
        version: 999 // Different version
      });

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => AdminService.refreshToken(validRefreshToken),
        AppError,
        'TOKEN_VERSION_MISMATCH'
      );
    });

    it('should throw error for locked account', async () => {
      // Arrange
      const lockedAdmin = {
        ...mockAdmin,
        lockoutUntil: Date.now() + 15 * 60 * 1000 // 15 minutes from now
      };

      jest.spyOn(jwt, 'verify').mockReturnValue({
        id: lockedAdmin._id,
        version: lockedAdmin.tokenVersion
      });

      AdminRepository.findById.mockResolvedValue(lockedAdmin);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => AdminService.refreshToken(validRefreshToken),
        AppError,
        'ACCOUNT_LOCKED'
      );
    });

    it('should increment token version on refresh', async () => {
      // Arrange

      jest.spyOn(jwt, 'verify').mockReturnValue({
        id: mockAdmin._id,
        version: mockAdmin.tokenVersion
      });

      // Act
      await AdminService.refreshToken(validRefreshToken);

      // Assert
      expect(AdminRepository.updateById).toHaveBeenCalledWith(
        mockAdmin._id,
        { tokenVersion: mockAdmin.tokenVersion + 1 }
      );
    });
  });

  describe('updateProfile', () => {
    it('should update admin profile successfully', async () => {
      // Arrange
      const mockAdmin = { ...adminData, _id: new mongoose.Types.ObjectId() };
      const updateData = { name: 'Updated Name' };

      AdminRepository.findByEmail.mockResolvedValue(null); // No duplicate
      AdminRepository.updateById.mockResolvedValue({ ...mockAdmin, ...updateData });

      // Act
      const result = await AdminService.updateProfile(mockAdmin._id, updateData);

      // Assert
      expect(AdminRepository.updateById).toHaveBeenCalledWith(mockAdmin._id, updateData);
      expect(result.name).toBe('Updated Name');
    });

    it('should throw error for duplicate email', async () => {
      // Arrange
      const mockAdmin = { ...adminData, _id: new mongoose.Types.ObjectId() };
      const existingAdmin = { ...adminData, _id: new mongoose.Types.ObjectId() };
      const updateData = { email: 'existing@test.com' };

      AdminRepository.findByEmail.mockResolvedValue(existingAdmin);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => AdminService.updateProfile(mockAdmin._id, updateData),
        AppError,
        'EMAIL_EXISTS'
      );
    });

    it('should allow same email for same admin', async () => {
      // Arrange
      const mockAdmin = { ...adminData, _id: new mongoose.Types.ObjectId() };
      const updateData = { email: mockAdmin.email };

      AdminRepository.findByEmail.mockResolvedValue(mockAdmin); // Same admin
      AdminRepository.updateById.mockResolvedValue(mockAdmin);

      // Act — pass adminId as string so the service comparison works
      const result = await AdminService.updateProfile(mockAdmin._id.toString(), updateData);

      // Assert
      expect(result.email).toBe(mockAdmin.email);
    });
  });

  describe('forgotPassword', () => {
    it('should generate and send OTP for valid admin', async () => {
      // Arrange
      const mockAdmin = { ...adminData, _id: new mongoose.Types.ObjectId() };
      AdminRepository.findByEmail.mockResolvedValue(mockAdmin);
      AdminRepository.updateById.mockResolvedValue(mockAdmin);

      // Act
      const result = await AdminService.forgotPassword(adminData.email);

      // Assert
      expect(AdminRepository.updateById).toHaveBeenCalledWith(
        mockAdmin._id,
        expect.objectContaining({
          resetPasswordOtp: expect.any(String),
          resetPasswordExpires: expect.any(Number)
        })
      );
      expect(result).toBe(true);
    });

    it('should throw error for non-existent admin', async () => {
      // Arrange
      AdminRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => AdminService.forgotPassword('nonexistent@test.com'),
        AppError,
        'ADMIN_NOT_FOUND'
      );
    });

    it('should handle locked account', async () => {
      // Arrange
      const lockedAdmin = {
        ...adminData,
        _id: new mongoose.Types.ObjectId(),
        resetPasswordLockout: Date.now() + 10 * 60 * 1000
      };
      AdminRepository.findByEmail.mockResolvedValue(lockedAdmin);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => AdminService.forgotPassword(adminData.email),
        AppError,
        'ACCOUNT_LOCKED'
      );
    });
  });
});
