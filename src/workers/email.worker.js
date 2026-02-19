import { Worker } from 'bullmq';
import EmailService from '../services/email.service.js';
import Logger from '../utils/logger.js';

/**
 * Email Queue Worker
 * Processes email sending jobs in background
 * 
 * Jobs:
 * - send-welcome: Welcome emails for new users
 * - send-order-confirmation: Order confirmation emails
 * - send-password-reset: Password reset emails
 * - send-custom: Custom template emails
 */

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const connection = redisUrl.startsWith('rediss://')
  ? { url: redisUrl, tls: { rejectUnauthorized: false } }
  : redisUrl;

const emailWorker = new Worker(
  'email',
  async (job) => {
    const { type, to, subject, html, template, data, role = 'supplier' } = job.data;

    Logger.info(`📧 Processing email job: ${job.id} - Type: ${type}`);

    try {
      switch (type) {
        case 'send-welcome':
          // Use template-based welcome email
          if (template) {
            await EmailService.sendEmailTemplate(
              to,
              template,
              data || { username: to },
              role
            );
          } else {
            await EmailService.sendEmail(
              to,
              subject || 'Welcome!',
              html || '<p>Welcome to our platform!</p>'
            );
          }
          break;

        case 'send-order-confirmation':
          await EmailService.sendEmailTemplate(
            to,
            'Order Confirmation',
            data || {},
            'customer'
          );
          break;

        case 'send-password-reset':
          await EmailService.sendEmail(
            to,
            'Password Reset',
            html || '<p>Reset your password</p>'
          );
          break;

        case 'send-custom':
          // Direct email or template-based
          if (template) {
            await EmailService.sendEmailTemplate(to, template, data || {}, role);
          } else {
            await EmailService.sendEmail(to, subject, html);
          }
          break;

        default:
          Logger.warn(`Unknown email type: ${type}`);
          throw new Error(`Unknown email type: ${type}`);
      }

      Logger.info(`✅ Email sent successfully: ${job.id} to ${to}`);
      return { success: true, to, type };
    } catch (error) {
      Logger.error(`❌ Failed to send email: ${job.id}`, {
        error: error.message,
        to,
        type,
      });
      throw error; // Re-throw for retry
    }
  },
  {
    connection,
    concurrency: 5, // Process 5 emails concurrently
    limiter: {
      max: 10, // Max 10 jobs per second (rate limiting)
      duration: 1000,
    },
  }
);

// Worker event listeners
emailWorker.on('completed', (job) => {
  Logger.debug(`Email job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  Logger.error(`Email job ${job.id} failed after ${job.attemptsMade} attempts`, {
    error: err.message,
  });
});

emailWorker.on('error', (err) => {
  Logger.error('Email worker error', { error: err.message });
});

Logger.info('📧 Email worker started');

export default emailWorker;
