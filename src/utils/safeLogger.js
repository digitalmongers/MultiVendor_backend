/**
 * ENTERPRISE LOG SANITIZER
 * Redacts sensitive information before logging.
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'api_key',
  'apiKey',
  'api_secret',
  'apiSecret',
  'card',
  'cvv',
  'authorization',
  'otp',
  'code',
  'resetPasswordOtp',
];

export const sanitize = (data, depth = 0) => {
  if (depth > 5) return '[DEPTH_LIMIT]';
  if (!data || typeof data !== 'object') return data;

  // Handle Buffer
  if (Buffer.isBuffer(data)) return '[BUFFER]';

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitize(item, depth + 1));
  }

  // Handle Errors
  if (data instanceof Error) {
    return {
      message: data.message,
      stack: data.stack,
      ...data,
    };
  }

  const sanitized = { ...data };

  for (const key in sanitized) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitize(sanitized[key], depth + 1);
    }
  }

  return sanitized;
};
