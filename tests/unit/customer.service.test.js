import { describe, beforeAll, beforeEach, expect, jest } from '@jest/globals';
import AppError from '../../src/utils/AppError.js';
import { TestDataFactory, TestUtils } from '../setup/test-setup.js';
import mongoose from 'mongoose';

// Define mocks using standard jest.mock
jest.mock('../../src/repositories/customer.repository.js', () => ({
  __esModule: true,
  default: {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateById: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../../src/models/customer.model.js', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.mock('../../src/repositories/loginSetting.repository.js', () => ({
  __esModule: true,
  default: {
    getSettings: jest.fn(),
  },
}));

jest.mock('../../src/services/cart.service.js', () => ({
  __esModule: true,
  default: {
    mergeGuestCart: jest.fn(),
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

// Import modules AFTER mocks
import CustomerService from '../../src/services/customer.service.js';
import CustomerRepository from '../../src/repositories/customer.repository.js';
import Customer from '../../src/models/customer.model.js';
import LoginSettingRepository from '../../src/repositories/loginSetting.repository.js';
import CartService from '../../src/services/cart.service.js';
import TransactionManager from '../../src/utils/transaction.js';
import { emailQueue } from '../../src/config/queue.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../src/utils/cloudinary.js';

describe('CustomerService', () => {
  let customerData;
  let mockLoginSettings;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    customerData = TestDataFactory.createCustomer();

    // Mock default login settings
    mockLoginSettings = {
      maxOtpHit: 3,
      temporaryBlockTime: 3600, // 1 hour in seconds
      otpResendTime: 60, // 1 minute in seconds
      maxLoginHit: 5,
      temporaryLoginBlockTime: 7200 // 2 hours in seconds
    };

    LoginSettingRepository.getSettings.mockResolvedValue(mockLoginSettings);
    emailQueue.add.mockResolvedValue({ id: 'mock-job-id' });
  });

  describe('signup', () => {
    it('should successfully signup a new customer', async () => {
      // Arrange
      const mockCustomer = { ...customerData, _id: new mongoose.Types.ObjectId() };
      const transactionMock = jest.fn((callback) => callback('mock-session'));

      TransactionManager.execute.mockImplementation(transactionMock);
      CustomerRepository.findByEmail.mockResolvedValue(null);
      CustomerRepository.create.mockResolvedValue(mockCustomer);

      // Act
      const result = await CustomerService.signup(customerData);

      // Assert
      expect(CustomerRepository.findByEmail).toHaveBeenCalledWith(customerData.email, '', true);
      expect(CustomerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...customerData,
          isVerified: false,
          verificationCode: expect.any(String),
          verificationCodeExpires: expect.any(Date)
        }),
        { session: 'mock-session' }
      );
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result.message).toContain('Signup successful');
    });

    it('should throw error for duplicate email during signup', async () => {
      // Arrange
      const existingCustomer = { ...customerData, _id: new mongoose.Types.ObjectId() };
      CustomerRepository.findByEmail.mockResolvedValue(existingCustomer);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.signup(customerData),
        AppError,
        'INTERNAL_ERROR'
      );
    });

    it('should handle email queue failure gracefully', async () => {
      // Arrange
      const mockCustomer = { ...customerData, _id: new mongoose.Types.ObjectId() };
      const transactionMock = jest.fn((callback) => callback('mock-session'));

      TransactionManager.execute.mockImplementation(transactionMock);
      CustomerRepository.findByEmail.mockResolvedValue(null);
      CustomerRepository.create.mockResolvedValue(mockCustomer);

      // Mock email queue failure
      emailQueue.add.mockRejectedValue(new Error('Email service down'));

      // Act - Should not throw error
      const result = await CustomerService.signup(customerData);

      // Assert
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP successfully', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        isVerified: false,
        verificationCode: '123456',
        verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0,
        save: jest.fn().mockResolvedValue(true)
      };

      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });

      // Act
      const result = await CustomerService.verifyOtp(customerData.email, '123456');

      // Assert
      expect(Customer.findOne).toHaveBeenCalledWith({ email: customerData.email, isVerified: false });
      expect(mockCustomer.save).toHaveBeenCalled();
      expect(mockCustomer.isVerified).toBe(true);
      expect(result.message).toContain('Email verified successfully');
    });

    it('should throw error for invalid OTP', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        isVerified: false,
        verificationCode: '123456',
        verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0
      };

      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });
      Customer.updateOne.mockResolvedValue(true);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.verifyOtp(customerData.email, '654321'),
        AppError
      );

      expect(Customer.updateOne).toHaveBeenCalledWith(
        { _id: mockCustomer._id },
        expect.objectContaining({
          $inc: { otpAttempts: 1 }
        })
      );
    });

    it('should lock account after max OTP attempts', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        isVerified: false,
        verificationCode: '123456',
        verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 2 // One more attempt will trigger lock
      };

      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });
      Customer.updateOne.mockResolvedValue(true);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.verifyOtp(customerData.email, '654321'),
        AppError
      );

      expect(Customer.updateOne).toHaveBeenCalledWith(
        { _id: mockCustomer._id },
        expect.objectContaining({
          $inc: { otpAttempts: 1 },
          $set: {
            otpLockUntil: expect.any(Number)
          }
        })
      );
    });

    it('should throw error for already verified customer', async () => {
      // Arrange
      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.verifyOtp(customerData.email, '123456'),
        AppError,
        'not found or already verified'
      );
    });
  });

  describe('resendOtp', () => {
    it('should resend OTP successfully', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        isVerified: false,
        updatedAt: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
      };

      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });
      Customer.updateOne.mockResolvedValue(true);

      // Act
      const result = await CustomerService.resendOtp(customerData.email);

      // Assert
      expect(Customer.updateOne).toHaveBeenCalledWith(
        { _id: mockCustomer._id },
        expect.objectContaining({
          $set: {
            verificationCode: expect.any(String),
            verificationCodeExpires: expect.any(Date)
          }
        })
      );
      expect(result.message).toContain('Verification code resent');
    });

    it('should enforce resend cooldown', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        isVerified: false,
        updatedAt: new Date(Date.now() - 30 * 1000) // 30 seconds ago
      };

      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.resendOtp(customerData.email),
        AppError,
        'Please wait'
      );
    });

    it('should throw error for already verified customer', async () => {
      // Arrange
      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.resendOtp(customerData.email),
        AppError,
        'already verified'
      );
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        isVerified: true,
        isActive: true,
        password: 'hashedpassword',
        matchPassword: jest.fn().mockResolvedValue(true),
        tokenVersion: 0
      };

      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });
      Customer.updateOne.mockResolvedValue(true);
      Customer.findById.mockResolvedValue(mockCustomer);

      // Act
      const result = await CustomerService.login(customerData.email, 'password');

      // Assert
      expect(mockCustomer.matchPassword).toHaveBeenCalledWith('password');
      expect(result).toHaveProperty('customer');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw error for unverified customer', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        isVerified: false,
        isActive: true
      };

      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.login(customerData.email, 'password'),
        AppError,
        'verify your email'
      );
    });

    it('should throw error for blocked customer', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        isVerified: true,
        isActive: false
      };

      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.login(customerData.email, 'password'),
        AppError,
        'account has been blocked'
      );
    });

    it('should lock account after max failed login attempts', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        isVerified: true,
        isActive: true,
        password: 'hashedpassword',
        matchPassword: jest.fn().mockResolvedValue(false),
        loginAttempts: 4
      };

      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });
      Customer.updateOne.mockResolvedValue(true);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.login(customerData.email, 'wrongpassword'),
        AppError
      );

      expect(Customer.updateOne).toHaveBeenCalledWith(
        { _id: mockCustomer._id },
        expect.objectContaining({
          $inc: { loginAttempts: 1 },
          $set: {
            lockUntil: expect.any(Number)
          }
        })
      );
    });

    it('should merge guest cart on successful login', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        isVerified: true,
        isActive: true,
        password: 'hashedpassword',
        matchPassword: jest.fn().mockResolvedValue(true),
        tokenVersion: 0
      };

      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });
      Customer.updateOne.mockResolvedValue(true);
      Customer.findById.mockResolvedValue(mockCustomer);

      const guestId = 'guest-123';

      // Act
      await CustomerService.login(customerData.email, 'password', guestId);

      // Assert
      expect(CartService.mergeGuestCart).toHaveBeenCalledWith(guestId, mockCustomer._id);
    });
  });

  describe('forgotPassword', () => {
    it('should send OTP for password reset', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        updatedAt: new Date(Date.now() - 2 * 60 * 1000)
      };

      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });
      Customer.updateOne.mockResolvedValue(true);

      // Act
      const result = await CustomerService.forgotPassword(customerData.email);

      // Assert
      expect(Customer.updateOne).toHaveBeenCalledWith(
        { _id: mockCustomer._id },
        expect.objectContaining({
          $set: {
            verificationCode: expect.any(String),
            verificationCodeExpires: expect.any(Date),
            otpAttempts: 0
          }
        })
      );
      expect(result.message).toContain('Verification code sent');
    });

    it('should enforce resend cooldown for password reset', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000),
        updatedAt: new Date(Date.now() - 30 * 1000)
      };

      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.forgotPassword(customerData.email),
        AppError,
        'Please wait'
      );
    });

    it('should throw error for non-existent customer', async () => {
      // Arrange
      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.forgotPassword('nonexistent@test.com'),
        AppError,
        'Account not found'
      );
    });
  });

  describe('verifyResetOtp', () => {
    it('should verify reset OTP successfully', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        verificationCode: '123456',
        verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0
      };

      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });
      Customer.updateOne.mockResolvedValue(true);

      // Act
      const result = await CustomerService.verifyResetOtp(customerData.email, '123456');

      // Assert
      expect(Customer.updateOne).toHaveBeenCalledWith(
        { _id: mockCustomer._id },
        expect.objectContaining({
          $set: { otpAttempts: 0, otpLockUntil: undefined }
        })
      );
      expect(result.message).toContain('OTP verified');
    });

    it('should throw error for invalid reset OTP', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        verificationCode: '123456',
        verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0
      };

      Customer.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });
      Customer.updateOne.mockResolvedValue(true);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.verifyResetOtp(customerData.email, '654321'),
        AppError
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        save: jest.fn().mockResolvedValue(true)
      };

      const transactionMock = jest.fn((callback) => callback('mock-session'));
      TransactionManager.execute.mockImplementation(transactionMock);

      Customer.findOneAndUpdate.mockResolvedValue(mockCustomer);

      // Act
      const result = await CustomerService.resetPassword(customerData.email, '123456', 'NewPassword123!');

      // Assert
      expect(Customer.findOneAndUpdate).toHaveBeenCalledWith(
        {
          email: customerData.email,
          verificationCode: '123456',
          verificationCodeExpires: { $gt: expect.any(Number) }
        },
        expect.objectContaining({
          $unset: { verificationCode: 1, verificationCodeExpires: 1 },
          $inc: { tokenVersion: 1 },
          $set: {
            password: 'NewPassword123!',
            lastPasswordReset: expect.any(Date)
          }
        }),
        { new: true, session: 'mock-session' }
      );
      expect(result.message).toContain('Password reset successfully');
    });

    it('should throw error for invalid reset code', async () => {
      // Arrange
      const transactionMock = jest.fn((callback) => callback({ session: 'mock-session' }));
      TransactionManager.execute.mockImplementation(transactionMock);

      Customer.findOneAndUpdate.mockResolvedValue(null);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.resetPassword(customerData.email, 'invalidcode', 'NewPassword123!'),
        AppError,
        'Invalid or expired verification code'
      );
    });
  });

  describe('getProfile', () => {
    it('should get customer profile successfully', async () => {
      // Arrange
      const mockCustomer = { ...customerData, _id: new mongoose.Types.ObjectId() };
      CustomerRepository.findById.mockResolvedValue(mockCustomer);

      // Act
      const result = await CustomerService.getProfile(mockCustomer._id);

      // Assert
      expect(CustomerRepository.findById).toHaveBeenCalledWith(mockCustomer._id, '', true);
      expect(result).toEqual(mockCustomer);
    });

    it('should throw error for non-existent customer', async () => {
      // Arrange
      CustomerRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.getProfile(new mongoose.Types.ObjectId()),
        AppError,
        'Customer not found'
      );
    });
  });

  describe('updateProfile', () => {
    it('should update customer profile successfully', async () => {
      // Arrange
      const mockCustomer = { ...customerData, _id: new mongoose.Types.ObjectId() };
      const updateData = { name: 'Updated Name', phoneNumber: '1234567890' };

      CustomerRepository.updateById.mockResolvedValue({ ...mockCustomer, ...updateData });

      // Act
      const result = await CustomerService.updateProfile(mockCustomer._id, updateData);

      // Assert
      expect(CustomerRepository.updateById).toHaveBeenCalledWith(
        mockCustomer._id,
        { name: 'Updated Name', phoneNumber: '1234567890' }
      );
      expect(result.name).toBe('Updated Name');
    });

    it('should filter sensitive fields during profile update', async () => {
      // Arrange
      const mockCustomer = { ...customerData, _id: new mongoose.Types.ObjectId() };
      const updateData = { name: 'Updated Name', password: 'newpassword', role: 'admin' };

      CustomerRepository.updateById.mockResolvedValue(mockCustomer);

      // Act
      await CustomerService.updateProfile(mockCustomer._id, updateData);

      // Assert
      expect(CustomerRepository.updateById).toHaveBeenCalledWith(
        mockCustomer._id,
        { name: 'Updated Name' } // Only allowed fields
      );
    });

    it('should throw error for non-existent customer during update', async () => {
      // Arrange
      CustomerRepository.updateById.mockResolvedValue(null);

      // Act & Assert
      await TestUtils.expectAsyncError(
        () => CustomerService.updateProfile(new mongoose.Types.ObjectId(), { name: 'Test' }),
        AppError,
        'Customer not found'
      );
    });
  });

  describe('updateStatus', () => {
    it('should update customer status successfully', async () => {
      // Arrange
      const mockCustomer = { ...customerData, _id: new mongoose.Types.ObjectId() };
      CustomerRepository.updateById.mockResolvedValue({ ...mockCustomer, isActive: false });

      // Act
      const result = await CustomerService.updateStatus(mockCustomer._id, false);

      // Assert
      expect(CustomerRepository.updateById).toHaveBeenCalledWith(
        mockCustomer._id,
        { isActive: false }
      );
      expect(result.isActive).toBe(false);
    });

    it('should queue status change email', async () => {
      // Arrange
      const mockCustomer = { ...customerData, _id: new mongoose.Types.ObjectId() };
      CustomerRepository.updateById.mockResolvedValue(mockCustomer);

      // Act
      await CustomerService.updateStatus(mockCustomer._id, false);

      // Assert
      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-custom',
        expect.objectContaining({
          template: 'Account Blocked',
          role: 'customer'
        })
      );
    });
  });

  describe('updateImage', () => {
    it('should update customer image successfully', async () => {
      // Arrange
      const mockCustomer = { ...customerData, _id: new mongoose.Types.ObjectId() };
      const mockFile = { buffer: 'test-image-data' };
      const uploadResult = { secure_url: 'http://example.com/image.jpg', public_id: 'image123' };

      CustomerRepository.findById.mockResolvedValue(mockCustomer);
      uploadToCloudinary.mockResolvedValue(uploadResult);
      CustomerRepository.updateById.mockResolvedValue({
        ...mockCustomer,
        photo: { url: uploadResult.secure_url, publicId: uploadResult.public_id }
      });

      // Act
      const result = await CustomerService.updateImage(mockCustomer._id, mockFile);

      // Assert
      expect(uploadToCloudinary).toHaveBeenCalledWith(mockFile, `customers/${mockCustomer._id}`);
      expect(CustomerRepository.updateById).toHaveBeenCalledWith(
        mockCustomer._id,
        expect.objectContaining({
          photo: {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id
          }
        })
      );
      expect(result.url).toBe(uploadResult.secure_url);
    });

    it('should delete old image before uploading new one', async () => {
      // Arrange
      const mockCustomer = {
        ...customerData,
        _id: new mongoose.Types.ObjectId(),
        photo: { url: 'old-url', publicId: 'old-public-id' }
      };
      const mockFile = { buffer: 'test-image-data' };

      CustomerRepository.findById.mockResolvedValue(mockCustomer);
      deleteFromCloudinary.mockResolvedValue(true);
      uploadToCloudinary.mockResolvedValue({ secure_url: 'new-url', public_id: 'new-id' });
      CustomerRepository.updateById.mockResolvedValue(mockCustomer);

      // Act
      await CustomerService.updateImage(mockCustomer._id, mockFile);

      // Assert
      expect(deleteFromCloudinary).toHaveBeenCalledWith('old-public-id');
    });
  });

  describe('getAllCustomers', () => {
    it('should get all customers with pagination', async () => {
      // Arrange
      const mockCustomers = [
        { ...customerData, _id: new mongoose.Types.ObjectId() },
        { ...customerData, _id: new mongoose.Types.ObjectId() }
      ];

      Customer.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockCustomers)
            })
          })
        })
      });

      Customer.countDocuments.mockResolvedValue(2);

      // Act
      const result = await CustomerService.getAllCustomers(1, 10);

      // Assert
      expect(Customer.find).toHaveBeenCalledWith({});
      expect(result.customers).toEqual(mockCustomers);
      expect(result.total).toBe(2);
    });

    it('should search customers by name, email, and phone', async () => {
      // Arrange
      const searchTerm = 'test';
      Customer.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([])
            })
          })
        })
      });

      // Act
      await CustomerService.getAllCustomers(1, 10, searchTerm);

      // Assert
      expect(Customer.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } },
            { phoneNumber: { $regex: searchTerm, $options: 'i' } }
          ]
        })
      );
    });

    it('should filter customers by status', async () => {
      // Arrange
      const status = 'active';
      Customer.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([])
            })
          })
        })
      });

      // Act
      await CustomerService.getAllCustomers(1, 10, '', status);

      // Assert
      expect(Customer.find).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true
        })
      );
    });
  });

  describe('invalidateAllSessions', () => {
    it('should invalidate all customer sessions', async () => {
      // Arrange
      const customerId = new mongoose.Types.ObjectId();
      Customer.updateOne.mockResolvedValue(true);

      // Act
      await CustomerService.invalidateAllSessions(customerId);

      // Assert
      expect(Customer.updateOne).toHaveBeenCalledWith(
        { _id: customerId },
        { $inc: { tokenVersion: 1 } }
      );
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      // Arrange
      const mockCustomer = {
        _id: new mongoose.Types.ObjectId(),
        tokenVersion: 5
      };

      // Act
      const tokens = CustomerService.generateTokens(mockCustomer);

      // Assert
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
    });
  });
});
