import argon2 from 'argon2';
import Logger from './logger.js';

/**
 * Enterprise Security Utility
 * Using Argon2 for password hashing (PHC string format).
 */
export const hashPassword = async (password) => {
  try {
    const isTest = process.env.NODE_ENV === 'test';
    return await argon2.hash(password, {
      type: argon2.argon2id, // Strongest variant
      memoryCost: isTest ? 2 ** 10 : 2 ** 16, // 1MB for tests vs 64MB for prod
      timeCost: isTest ? 1 : 3, // 1 iteration for tests vs 3 for prod
      parallelism: 1,
    });
  } catch (error) {
    Logger.error('Hashing Failed', { error: error.message });
    throw error;
  }
};

export const comparePassword = async (hash, password) => {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    Logger.error('Password Verification Failed', { error: error.message });
    return false;
  }
};
