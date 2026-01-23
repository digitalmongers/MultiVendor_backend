import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Sentry from '@sentry/node';
import { sanitize } from './safeLogger.js';
import RequestContext from './context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { combine, timestamp, errors, printf, colorize, json, metadata } = winston.format;

const devLogFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}] : ${stack || message}`;
  const metaKeys = Object.keys(meta).filter(key => key !== 'service');
  if (metaKeys.length > 0) log += `\n${JSON.stringify(meta, null, 2)}`;
  return log;
});

const prodLogFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
  json()
);

const developmentFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  colorize({ all: true }),
  devLogFormat
);

const transports = [
  new winston.transports.Console({
    handleExceptions: true,
    handleRejections: true,
    format: process.env.NODE_ENV === 'production' ? prodLogFormat : developmentFormat,
  })
];

if (process.env.NODE_ENV !== 'production' || process.env.PERSISTENT_LOGS === 'true') {
  transports.push(
    new DailyRotateFile({
      filename: path.join(__dirname, '../../logs/%DATE%-combined.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: prodLogFormat,
    }),
    new DailyRotateFile({
      filename: path.join(__dirname, '../../logs/%DATE%-error.log'),
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '30d',
      format: prodLogFormat,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: process.env.NODE_ENV === 'production' ? prodLogFormat : developmentFormat,
  defaultMeta: { service: 'multi-vendor-api' },
  transports,
});

class Logger {
  static info(message, meta = {}) { 
    logger.info(message, sanitize({ ...RequestContext.getAll(), ...meta })); 
  }
  
  static error(message, meta = {}) { 
    const contextMeta = { ...RequestContext.getAll(), ...meta };
    logger.error(message, sanitize(contextMeta)); 
    
    // Enterprise: Report to Sentry
    if (meta.error instanceof Error) {
      Sentry.captureException(meta.error, { extra: sanitize(contextMeta) });
    } else {
      Sentry.captureMessage(message, { level: 'error', extra: sanitize(contextMeta) });
    }
  }

  static warn(message, meta = {}) { 
    logger.warn(message, sanitize({ ...RequestContext.getAll(), ...meta })); 
  }

  static debug(message, meta = {}) { 
    logger.debug(message, sanitize({ ...RequestContext.getAll(), ...meta })); 
  }

  static http(message, meta = {}) { 
    logger.http(message, sanitize({ ...RequestContext.getAll(), ...meta })); 
  }

  static logRequest(req) {
    logger.http('HTTP Request', {
      requestId: req.requestId || req.id,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      query: sanitize(req.query),
      body: sanitize(req.body),
    });
  }

  static logResponse(req, res, responseTime, responseBody = null) {
    logger[res.statusCode >= 400 ? 'warn' : 'http']('HTTP Response', sanitize({
      ...RequestContext.getAll(),
      requestId: req.requestId || req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      responseBody: responseBody,
    }));
  }

  static logError(error, req = null) {
    const errorLog = {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      code: error.code,
    };
    if (req) {
      errorLog.request = {
        requestId: req.requestId || req.id,
        method: req.method,
        url: req.url,
      };
    }
    logger.error('Application Error', errorLog);
  }
}

export { logger };
export default Logger;
