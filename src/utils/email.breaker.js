import CircuitBreaker from 'opossum';
import sgMail from '@sendgrid/mail';
import env from '../config/env.js';
import Logger from './logger.js';

// Initialize SendGrid
sgMail.setApiKey(env.SENDGRID_API_KEY);

/**
 * Enterprise Circuit Breaker for SendGrid Email Service
 * Prevents cascade failures when SendGrid is down or slow
 */
const breakerOptions = {
  timeout: 5000,                // 5 seconds timeout
  errorThresholdPercentage: 50,   // 50% fail = open circuit
  resetTimeout: 30000,          // 30 seconds baad retry
  volumeThreshold: 5            // Min 5 requests to calculate failure rate
};

/**
 * Core email sending function wrapped by circuit breaker
 * @param {Object} msg - SendGrid message object
 * @returns {Promise} - SendGrid API response
 */
const sendEmailAction = async (msg) => {
  return await sgMail.send(msg);
};

// Create circuit breaker
const emailBreaker = new CircuitBreaker(sendEmailAction, breakerOptions);

// Fallback function when circuit is open
emailBreaker.fallback((msg) => {
  Logger.warn(`📧 Email fallback triggered for ${msg.to}`);
  return { 
    success: false, 
    message: 'Email service temporarily unavailable',
    fallback: true 
  };
});

// Event listeners for monitoring
emailBreaker.on('open', () => {
  Logger.warn('⚠️ Email Circuit Breaker OPENED - SendGrid calls blocked');
});

emailBreaker.on('halfOpen', () => {
  Logger.info('🔄 Email Circuit Breaker HALF-OPEN - Testing SendGrid');
});

emailBreaker.on('close', () => {
  Logger.info('✅ Email Circuit Breaker CLOSED - SendGrid operational');
});

emailBreaker.on('fallback', (data) => {
  Logger.error('❌ Email Circuit Breaker FALLBACK executed', data);
});

// Track stats
emailBreaker.on('success', () => {
  Logger.debug('📧 Email sent successfully via circuit breaker');
});

emailBreaker.on('failure', (error) => {
  Logger.error('❌ Email sending failed', { error: error.message });
});

export default emailBreaker;
