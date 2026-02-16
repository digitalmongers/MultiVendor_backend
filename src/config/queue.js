import { Queue, Worker } from 'bullmq';
import redisClient from './redis.js';
import Logger from '../utils/logger.js';

/**
 * BullMQ Queue Configuration
 * Enterprise-grade background job processing
 */

// Redis connection for BullMQ
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

// Queue Names
export const QUEUE_NAMES = {
  EMAIL: 'email',
  BULK_IMPORT: 'bulk-import',
  EXPORT: 'data-export',
};

// Default job options
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    count: 100, // Keep last 100 completed jobs
  },
  removeOnFail: {
    count: 50, // Keep last 50 failed jobs for debugging
  },
};

/**
 * Create Queue Instances
 */
export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    priority: 1, // High priority for emails
  },
});

export const bulkImportQueue = new Queue(QUEUE_NAMES.BULK_IMPORT, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
  },
});

export const exportQueue = new Queue(QUEUE_NAMES.EXPORT, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
  },
});

/**
 * Queue Event Listeners for Monitoring
 */
emailQueue.on('completed', (job) => {
  Logger.info(`📧 Email job completed: ${job.id} - ${job.data.template || 'custom'}`);
});

emailQueue.on('failed', (job, err) => {
  Logger.error(`❌ Email job failed: ${job.id}`, { error: err.message });
});

bulkImportQueue.on('completed', (job) => {
  Logger.info(`📦 Bulk import completed: ${job.id}`);
});

bulkImportQueue.on('failed', (job, err) => {
  Logger.error(`❌ Bulk import failed: ${job.id}`, { error: err.message });
});

exportQueue.on('completed', (job) => {
  Logger.info(`📊 Export completed: ${job.id}`);
});

exportQueue.on('failed', (job, err) => {
  Logger.error(`❌ Export failed: ${job.id}`, { error: err.message });
});

/**
 * Graceful shutdown helper
 */
export const closeQueues = async () => {
  await emailQueue.close();
  await bulkImportQueue.close();
  await exportQueue.close();
  Logger.info('All BullMQ queues closed');
};

export default {
  emailQueue,
  bulkImportQueue,
  exportQueue,
  closeQueues,
  QUEUE_NAMES,
};
