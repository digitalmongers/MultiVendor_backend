/**
 * Worker Starter
 * Initializes all background job workers
 * 
 * Import this in server.js to start workers
 */

import './email.worker.js';
// import './bulkImport.worker.js'; // Uncomment when needed
// import './export.worker.js'; // Uncomment when needed

import Logger from '../utils/logger.js';

Logger.info('🚀 All background workers initialized');
