const { describe, beforeAll, afterAll, beforeEach, expect } = require('@jest/globals');
import request from 'supertest';
import app from '../../src/app.js';
import { TestDataFactory, TestUtils, TestDatabase } from '../setup/test-setup.js';
import mongoose from 'mongoose';

describe('Authentication Integration Tests', () => {
  let testDB;
  let adminData;
  let customerData;

  beforeAll(async () => {
    testDB = new TestDatabase();
    await testDB.connect();
  });

  afterAll(async () => {
    await testDB.disconnect();
  });

  beforeEach(async () => {
    await testDB.clearDatabase();
    adminData = TestDataFactory.createAdmin();
    customerData = TestDataFactory.createCustomer();
  });

  describe('Admin Authentication Flow', () => {
    it('should complete full admin login flow', async () => {
      // 1. Create admin in database
      const createResponse = await request(app)
        .post('/api/v1/admin/auth/register')
        .send(adminData)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.admin.email).toBe(adminData.email);

      // 2. Login with created admin
      const loginResponse = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({
          email: adminData.email,
          password: adminData.password
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.tokens.accessToken).toBeDefined();
      expect(loginResponse.body.data.tokens.refreshToken).toBeDefined();

      // 3. Access protected route with token
      const accessToken = loginResponse.body.data.tokens.accessToken;
      const profileResponse = await request(app)
        .get('/api/v1/admin/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body.data.email).toBe(adminData.email);

      // 4. Refresh token
      const refreshToken = loginResponse.body.data.tokens.refreshToken;
      const refreshResponse = await request(app)
        .post('/api/v1/admin/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body.data.accessToken).toBeDefined();
      expect(refreshResponse.body.data.refreshToken).toBeDefined();
      expect(refreshResponse.body.data.tokenVersion).toBeGreaterThan(0);

      // 5. Logout
      const logoutResponse = await request(app)
        .post('/api/v1/admin/auth/logout')
        .set('Authorization', `Bearer ${refreshResponse.body.data.accessToken}`)
        .expect(200);

      expect(logoutResponse.body.success).toBe(true);
    });

    it('should handle login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({
          email: adminData.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ADMIN_AUTH');
    });

    it('should handle account lockout after multiple failed attempts', async () => {
      // Create admin first
      await TestUtils.createTestUser(mongoose.model('Admin'), adminData);

      // Attempt login 5 times with wrong password
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/admin/auth/login')
          .send({
            email: adminData.email,
            password: 'wrongpassword'
          });
      }

      // 6th attempt should be locked
      const response = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({
          email: adminData.email,
          password: 'wrongpassword'
        })
        .expect(429);

      expect(response.body.error.code).toBe('ACCOUNT_LOCKED');
    });
  });

  describe('Customer Authentication Flow', () => {
    it('should complete full customer signup and verification flow', async () => {
      // 1. Signup
      const signupResponse = await request(app)
        .post('/api/v1/customers/signup')
        .send(customerData)
        .expect(201);

      expect(signupResponse.body.success).toBe(true);
      expect(signupResponse.body.data.email).toBe(customerData.email);

      // 2. Verify OTP (assuming OTP is sent via email)
      const customer = await mongoose.model('Customer').findOne({ email: customerData.email });
      const otpResponse = await request(app)
        .post('/api/v1/customers/verify-otp')
        .send({
          email: customerData.email,
          code: customer.verificationCode
        })
        .expect(200);

      expect(otpResponse.body.success).toBe(true);

      // 3. Login after verification
      const loginResponse = await request(app)
        .post('/api/v1/customers/login')
        .send({
          email: customerData.email,
          password: customerData.password
        })
        .expect(200);

      expect(loginResponse.body.data.customer.email).toBe(customerData.email);
      expect(loginResponse.body.data.token).toBeDefined();
    });

    it('should handle signup with duplicate email', async () => {
      // Create first customer
      await TestUtils.createTestUser(mongoose.model('Customer'), customerData);

      // Try to create second customer with same email
      const response = await request(app)
        .post('/api/v1/customers/signup')
        .send(customerData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DUPLICATE_RESOURCE');
    });
  });

  describe('Token Security Integration', () => {
    let accessToken;
    let refreshToken;

    beforeEach(async () => {
      // Create and login admin
      await TestUtils.createTestUser(mongoose.model('Admin'), adminData);
      
      const loginResponse = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({
          email: adminData.email,
          password: adminData.password
        });

      accessToken = loginResponse.body.data.tokens.accessToken;
      refreshToken = loginResponse.body.data.tokens.refreshToken;
    });

    it('should reject access with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/admin/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject access with expired token', async () => {
      // Create expired token
      const expiredToken = TestUtils.generateJWT(
        adminData._id, 
        'test-secret', 
        '-1h' // Expired
      );

      const response = await request(app)
        .get('/api/v1/admin/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle token rotation correctly', async () => {
      // First refresh
      const firstRefresh = await request(app)
        .post('/api/v1/admin/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      const firstNewToken = firstRefresh.body.data.refreshToken;

      // Try to use old refresh token again
      const secondRefresh = await request(app)
        .post('/api/v1/admin/auth/refresh-token')
        .send({ refreshToken: refreshToken }) // Old token
        .expect(401);

      expect(secondRefresh.body.error.code).toBe('TOKEN_VERSION_MISMATCH');

      // New refresh token should work
      const thirdRefresh = await request(app)
        .post('/api/v1/admin/auth/refresh-token')
        .send({ refreshToken: firstNewToken })
        .expect(200);

      expect(thirdRefresh.body.data.refreshToken).toBeDefined();
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should rate limit auth endpoints', async () => {
      const promises = Array(10).fill().map(() =>
        request(app)
          .post('/api/v1/customers/login')
          .send({
            email: 'test@test.com',
            password: 'password'
          })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation Integration', () => {
    it('should validate admin login input', async () => {
      const response = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({
          email: 'invalid-email',
          password: '123' // Too short
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.errors).toHaveLength(2);
    });

    it('should validate customer signup input', async () => {
      const response = await request(app)
        .post('/api/v1/customers/signup')
        .send({
          email: 'invalid-email',
          password: '123',
          name: '' // Empty name
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'email' }),
          expect.objectContaining({ path: 'password' }),
          expect.objectContaining({ path: 'name' })
        ])
      );
    });

    it('should sanitize malicious input', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>',
        email: 'test@test.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/v1/customers/signup')
        .send(maliciousData)
        .expect(201);

      // Check that script was sanitized
      expect(response.body.data.data.name).not.toContain('<script>');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      const originalConnect = mongoose.connect;
      mongoose.connect = jest.fn().mockRejectedValue(new Error('DB Connection Failed'));

      const response = await request(app)
        .post('/api/v1/admin/auth/login')
        .send(adminData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Something went wrong');

      // Restore original
      mongoose.connect = originalConnect;
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({}) // Empty body
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.errors).toBeDefined();
    });
  });
});
