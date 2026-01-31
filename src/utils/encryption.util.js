import crypto from 'crypto';
import env from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text in format: iv:authTag:encryptedData
 */
export const encrypt = (text) => {
  if (!text) return null;
  
  // Use a hash of JWT_SECRET as the key if ENCRYPTION_KEY is not defined
  const key = crypto.createHash('sha256').update(env.ENCRYPTION_KEY || env.JWT_SECRET).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypt sensitive data
 * @param {string} encryptedText - Encrypted text in format: iv:authTag:encryptedData
 * @returns {string} - Decrypted plain text
 */
export const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !authTagHex || !encrypted) return null;
    
    const key = crypto.createHash('sha256').update(env.ENCRYPTION_KEY || env.JWT_SECRET).digest();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
};
