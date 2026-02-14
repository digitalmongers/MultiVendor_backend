import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection Pooling - CRITICAL for performance
      maxPoolSize: 100,       // Max 100 connections in pool
      minPoolSize: 10,        // Always keep 10 connections ready
      maxIdleTimeMS: 30000,   // Close idle connections after 30s
      
      // Timeouts
      serverSelectionTimeoutMS: 5000,  // 5s to find available server
      socketTimeoutMS: 45000,          // 45s socket timeout
      connectTimeoutMS: 10000,         // 10s connection timeout
      
      // Retry logic
      retryWrites: true,
      retryReads: true,
    });
    logger.info(`MongoDB Connected: ${conn.connection.host} (Pool: 100)`);
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
