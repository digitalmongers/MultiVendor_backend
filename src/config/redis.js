import Redis from 'ioredis';
import env from './env.js';
import Logger from '../utils/logger.js';

// Base config for Redis operations (Enterprise standard)
const redisConfig = {
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    Logger.debug(`Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  lazyConnect: true, // Connect when needed or manually
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      Logger.warn('Redis READONLY error, reconnecting...');
      return true;
    }
    return false;
  },
};

/**
 * Get Redis Connection Options
 * Enterprise Pattern: Centralized connection logic
 */
export const getRedisConnection = () => {
  const isTls = env.REDIS_URL?.startsWith('rediss://');

  const options = env.REDIS_URL
    ? {
      host: new URL(env.REDIS_URL).hostname,
      port: parseInt(new URL(env.REDIS_URL).port) || 6379,
      password: new URL(env.REDIS_URL).password || undefined,
      tls: isTls ? { rejectUnauthorized: false } : undefined
    }
    : {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD
    };

  // Log connection target (sanitized)
  const target = env.REDIS_URL
    ? env.REDIS_URL.replace(/:[^:]*@/, ':***@')
    : `${env.REDIS_HOST}:${env.REDIS_PORT}`;

  Logger.info(`Redis connection target: ${target}`);

  return options;
};

const connectionOptions = getRedisConnection();

const redisClient = new Redis({ ...redisConfig, ...connectionOptions });

redisClient.on('error', (err) => {
  Logger.error('REDIS_ERROR', { error: err.message, stack: err.stack });
});

redisClient.on('connect', () => {
  Logger.info('REDIS_CONNECTED');
});

redisClient.on('ready', () => {
  Logger.info('REDIS_READY');
});

redisClient.on('reconnecting', (delay) => {
  Logger.warn('REDIS_RECONNECTING', { delay });
});

redisClient.on('close', () => {
  Logger.warn('REDIS_CONNECTION_CLOSED');
});

/**
 * Handle Redis Shutdown
 */
export const closeRedis = async () => {
  if (redisClient) {
    Logger.info('Closing Redis connection...');
    await redisClient.quit();
  }
};

export default redisClient;
