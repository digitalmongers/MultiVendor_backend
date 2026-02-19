import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import responseTime from 'response-time';

// 1. Load and Validate Env (Fail-Fast)
import env from './src/config/env.js';

// 2. Monitoring (Sentry must be first)
import Sentry, { setupExpressErrorHandler } from "./instrument.js";

// Configs
import connectDB from './src/config/db.js';
import redisClient, { closeRedis } from './src/config/redis.js';
import { setupSwagger } from './src/config/swagger.js';

// Middlewares
import { requestIdMiddleware } from './src/middleware/requestId.js';
import { contextMiddleware } from './src/middleware/context.middleware.js';
import { requestLogger } from './src/middleware/requestLogger.js';
import { responseHandler } from './src/middleware/response.middleware.js';
import securityMiddleware from './src/middleware/security.middleware.js';
import { errorHandler } from './src/middleware/error.middleware.js';
import Logger from './src/utils/logger.js';

// Routes
import v1Routes from './src/routes/v1.routes.js';
import healthRoutes from './src/routes/health.routes.js';
import AdminService from './src/services/admin.service.js';
import SupplierEmailTemplateService from './src/services/supplierEmailTemplate.service.js';
import CustomerEmailTemplateService from './src/services/customerEmailTemplate.service.js';
import AdminEmailTemplateService from './src/services/adminEmailTemplate.service.js';

// Connect to database
console.log('Connecting to database...');
await connectDB();
console.log('Connected to database.');

// Connect to Redis (Enterprise: verify connectivity on startup)
try {
  await redisClient.connect();
} catch (err) {
  Logger.error('Redis connection failed on startup', { error: err.message });
  // We don't exit(1) here if Redis is optional, but for enterprise we usually want it.
}

// Bootstrap Admin & Email Templates
await AdminService.bootstrapAdmin();
await SupplierEmailTemplateService.bootstrapTemplates();
await CustomerEmailTemplateService.bootstrapTemplates();
await AdminEmailTemplateService.bootstrapTemplates();

// Initialize Background Workers (BullMQ)
await import('./src/workers/index.js');

const app = express();

// Trust proxy for rate limiting on Render/Cloud
app.set('trust proxy', 1);



/**
 * PRODUCTION-GRADE MIDDLEWARE STACK
 */
// 1. Request Size Limits - Security & Performance
// JSON API limit - sufficient for most requests, prevents DoS
app.use(express.json({
  limit: '100kb',              // 100KB for JSON (bulk operations support)
  strict: true,                // Only arrays/objects, no primitives
  verify: (req, res, buf) => {
    // Log large requests for monitoring
    if (buf.length > 50000) {
      Logger.warn('Large JSON request detected', {
        size: buf.length,
        path: req.path,
        ip: req.ip
      });
    }
  }
}));

// URL-encoded form data limit
app.use(express.urlencoded({
  extended: true,              // Allow rich objects/arrays
  limit: '50kb',              // 50KB for form data
  parameterLimit: 1000        // Max 1000 parameters (prevent hash collision attacks)
}));

// Text body limit for webhooks/XML
app.use(express.text({
  limit: '100kb',
  type: ['text/plain', 'application/xml', 'text/xml']
}));

// Raw binary limit for specific routes (if needed)
app.use(express.raw({
  limit: '5mb',                // 5MB for file uploads/binary
  type: 'application/octet-stream'
}));
app.use(cookieParser());
// 3. Response Compression - Optimized for API responses
app.use(compression({
  level: 6,                    // Balanced compression (1-9)
  filter: (req, res) => {
    // Skip compression for small responses (< 1KB)
    if (req.headers['x-no-compression']) return false;

    // Skip compression for already compressed formats
    const noCompress = /\.(jpg|jpeg|png|gif|webp|mp4|mp3|pdf|zip|gz)$/i;
    if (noCompress.test(req.path)) return false;

    // Compress JSON, HTML, CSS, JS, Text
    return compression.filter(req, res);
  },
  threshold: 1024,             // Only compress responses > 1KB
  memLevel: 8,                 // Memory usage (1-9)
}));
app.use(responseTime());

// Global Identifiers & Context
app.use(requestIdMiddleware);
app.use(contextMiddleware);
app.use(requestLogger);

// Global Response Formatter (Senior/Principal Pattern)
app.use(responseHandler);

// Elite Security Stack
securityMiddleware(app);

// Documentation
setupSwagger(app);

/**
 * ROUTE REGISTRATION (Versioned)
 */
app.use('/health', healthRoutes); // Health is usually top-level
app.use('/api/v1', v1Routes);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Multi Vendor Backend API',
    status: 'ONLINE',
    version: '1.0.0',
    docs: '/api-docs'
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    message: `Cannot find ${req.originalUrl} on this server!`
  });
});

/**
 * PRODUCTION-GRADE ERROR HANDLING
 */
if (setupExpressErrorHandler) setupExpressErrorHandler(app);
app.use(errorHandler);

const PORT = env.PORT || 5000;

const server = app.listen(PORT, () => {
  Logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${PORT}`);
});

// HTTP Keep-Alive Configuration (Experience Developer Best Practice)
// Keep connections alive to reuse TCP connections = Better Performance
server.keepAliveTimeout = 65000;  // 65 seconds
server.headersTimeout = 66000;    // 66 seconds (must be > keepAliveTimeout)

/**
 * GRACEFUL SHUTDOWN
 */
const gracefulShutdown = (signal) => {
  Logger.warn(`RECEIVED ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    Logger.info('HTTP server closed.');
    try {
      const mongoose = (await import('mongoose')).default;
      await mongoose.connection.close();
      Logger.info('Database connection closed.');

      await closeRedis();
      Logger.info('Redis connection closed.');

      process.exit(0);
    } catch (err) {
      Logger.error('Error during shutdown', { error: err.message });
      process.exit(1);
    }
  });

  setTimeout(() => {
    Logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  Logger.error(`Unhandled Rejection: ${err.message}`, { stack: err.stack });
});

process.on('uncaughtException', (err) => {
  Logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
