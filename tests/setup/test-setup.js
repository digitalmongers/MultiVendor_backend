import { describe, beforeAll, afterAll, beforeEach, expect, jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';

// Mock Redis and BullMQ to prevent connection attempts
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    publish: jest.fn(),
    quit: jest.fn(),
    duplicate: jest.fn().mockReturnThis(),
  }));
});

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
}));

/**
 * Test Database Setup
 * Creates isolated in-memory database for each test suite
 */
class TestDatabase {
  constructor() {
    this.mongoServer = null;
    this.connection = null;
  }

  async connect() {
    this.mongoServer = await MongoMemoryServer.create();
    const uri = this.mongoServer.getUri();

    await mongoose.connect(uri);
    console.log(`🧪 Test DB Connected: ${uri}`);
  }

  async disconnect() {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }

    if (this.mongoServer) {
      await this.mongoServer.stop();
    }

    console.log('🧪 Test DB Disconnected');
  }

  async clearDatabase() {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
}

/**
 * Test Data Factory
 * Generates realistic test data using Faker
 */
class TestDataFactory {
  // User Factories
  static createAdmin(overrides = {}) {
    return {
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: 'TestPassword123!',
      phoneNumber: faker.phone.number('91##########').toString(),
      role: 'admin',
      isActive: true,
      tokenVersion: 0,
      ...overrides
    };
  }

  static createCustomer(overrides = {}) {
    return {
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: 'TestPassword123!',
      phoneNumber: faker.phone.number('91##########').toString(),
      isVerified: true,
      isActive: true,
      tokenVersion: 0,
      ...overrides
    };
  }

  static createVendor(overrides = {}) {
    return {
      name: faker.company.name(),
      email: faker.internet.email(),
      password: 'TestPassword123!',
      phoneNumber: faker.phone.number('91##########').toString(),
      businessName: faker.company.name(),
      businessType: faker.helpers.arrayElement(['retail', 'wholesale', 'manufacturer']),
      isActive: true,
      tokenVersion: 0,
      ...overrides
    };
  }

  // Product Factories
  static createProduct(overrides = {}) {
    return {
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      price: parseFloat(faker.commerce.price({ min: 10, max: 1000 })),
      discount: faker.datatype.number({ min: 0, max: 50 }),
      discountType: faker.helpers.arrayElement(['flat', 'percent']),
      category: faker.database.mongodbObjectId(),
      subcategory: faker.database.mongodbObjectId(),
      vendor: faker.database.mongodbObjectId(),
      sku: faker.string.alphanumeric(10),
      stock: faker.datatype.number({ min: 1, max: 100 }),
      images: [
        {
          url: faker.image.url(),
          publicId: faker.string.alphanumeric(20)
        }
      ],
      isActive: true,
      ...overrides
    };
  }

  // Order Factories
  static createOrder(overrides = {}) {
    return {
      customer: faker.database.mongodbObjectId(),
      vendor: faker.database.mongodbObjectId(),
      items: [
        {
          product: faker.database.mongodbObjectId(),
          quantity: faker.datatype.number({ min: 1, max: 5 }),
          price: parseFloat(faker.commerce.price({ min: 10, max: 500 }))
        }
      ],
      totalAmount: parseFloat(faker.commerce.price({ min: 50, max: 2000 })),
      status: faker.helpers.arrayElement(['pending', 'confirmed', 'shipped', 'delivered']),
      paymentStatus: faker.helpers.arrayElement(['pending', 'paid', 'failed']),
      ...overrides
    };
  }

  // Cart Factories
  static createCartItem(overrides = {}) {
    return {
      customer: faker.database.mongodbObjectId(),
      product: faker.database.mongodbObjectId(),
      quantity: faker.datatype.number({ min: 1, max: 10 }),
      variation: {
        size: faker.helpers.arrayElement(['S', 'M', 'L', 'XL']),
        color: faker.color.human()
      },
      ...overrides
    };
  }

  // Support Ticket Factories
  static createSupportTicket(overrides = {}) {
    return {
      customer: faker.database.mongodbObjectId(),
      subject: faker.lorem.sentence(),
      message: faker.lorem.paragraphs(2),
      priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'urgent']),
      status: faker.helpers.arrayElement(['open', 'in-progress', 'resolved', 'closed']),
      category: faker.helpers.arrayElement(['technical', 'billing', 'account', 'product']),
      ...overrides
    };
  }

  // Invalid Data for Edge Cases
  static createInvalidEmail() {
    return {
      email: faker.helpers.arrayElement([
        'invalid-email',
        'test@',
        '@domain.com',
        'test..test@domain.com',
        'test@domain',
        ''
      ])
    };
  }

  static createInvalidPassword() {
    return {
      password: faker.helpers.arrayElement([
        '',
        '123',
        'password',
        'test',
        'a',
        'NO',
        '   ',
        'Test123' // no special char
      ])
    };
  }

  static createInvalidPhone() {
    return {
      phoneNumber: faker.helpers.arrayElement([
        '123',
        '123456789012345',
        'abcdefghij',
        '+91-1234567890',
        '98765 43210',
        ''
      ])
    };
  }
}

/**
 * Test Utilities
 */
class TestUtils {
  static async createTestUser(userModel, userData) {
    const user = new userModel(userData);
    return await user.save();
  }

  static generateJWT(userId, secret = 'test-secret', expiresIn = '1h') {
    return jwt.sign({ id: userId }, secret, { expiresIn });
  }

  static async setupTestDatabase() {
    const testDB = new TestDatabase();
    await testDB.connect();
    return testDB;
  }

  static async cleanupTestDatabase(testDB) {
    await testDB.clearDatabase();
    await testDB.disconnect();
  }

  // Mock Request/Response
  static mockRequest(overrides = {}) {
    return {
      body: {},
      params: {},
      query: {},
      headers: {},
      cookies: {},
      user: null,
      ...overrides
    };
  }

  static mockResponse() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  }

  // Async Error Helper
  static async expectAsyncError(asyncFn, expectedErrorClass, expectedMessage) {
    try {
      await asyncFn();
      throw new Error('Expected async function to throw an error');
    } catch (error) {
      expect(error).toBeInstanceOf(expectedErrorClass);
      if (expectedMessage) {
        // Check if expectedMessage matches error code OR is contained in error message
        const isCodeMatch = error.code === expectedMessage;
        const isMessageMatch = error.message && error.message.includes(expectedMessage);

        if (!isCodeMatch && !isMessageMatch) {
          throw new Error(`Expected error to contain "${expectedMessage}" but got code "${error.code}" and message "${error.message}"`);
        }
      }
    }
  }
}

export {
  TestDatabase,
  TestDataFactory,
  TestUtils
};
