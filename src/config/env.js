import { z } from 'zod';
import dotenv from 'dotenv';
import Logger from '../utils/logger.js';

dotenv.config();

/**
 * Enterprise Environment Schema
 * Validates all required environment variables on startup (Fail-Fast).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  MONGODB_URI: z.string().url('MONGODB_URI must be a valid connection string'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET should be at least 32 characters'),
  JWT_EXPIRE: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRE: z.string().default('30d'),
  
  // Cloudinary
  CLOUD_NAME: z.string().min(1, 'CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Admin Credentials
  ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be a valid email'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),

  // Allowed Origins for CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),

  // SendGrid
  SENDGRID_API_KEY: z.string().min(1, 'SENDGRID_API_KEY is required for emails'),
  EMAIL_FROM: z.string().email('EMAIL_FROM must be a valid email'),
  EMAIL_FROM_NAME: z.string().default('Admin Support'),

  // Mailchimp
  MAILCHIMP_API_KEY: z.string().optional(),
  MAILCHIMP_SERVER_PREFIX: z.string().optional(),
  MAILCHIMP_AUDIENCE_ID: z.string().optional(),

  // Optional but recommended
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  REDIS_URL: z.string().url().optional(),
});

let env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  Logger.error('❌ Invalid Environment Variables:', error.format());
  process.exit(1);
}

export default env;
