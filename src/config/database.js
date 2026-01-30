const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Database Connection Manager
 */
class Database {
  constructor() {
    this.connection = null;
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    try {
      if (this.connection) {
        logger.warn('Database already connected');
        return this.connection;
      }

      mongoose.set('strictQuery', false);

      this.connection = await mongoose.connect(config.mongodb.uri, config.mongodb.options);

      logger.info(`MongoDB connected successfully: ${config.mongodb.uri.split('@')[1] || 'localhost'}`);

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

      return this.connection;
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    try {
      if (!this.connection) {
        return;
      }

      await mongoose.connection.close();
      this.connection = null;
      logger.info('MongoDB disconnected successfully');
    } catch (error) {
      logger.error('MongoDB disconnect error:', error);
      throw error;
    }
  }

  /**
   * Clear all collections (for testing)
   */
  async clearDatabase() {
    if (config.env !== 'test') {
      throw new Error('clearDatabase can only be used in test environment');
    }

    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
    logger.info('Database cleared');
  }

  /**
   * Get connection status
   */
  isConnected() {
    return mongoose.connection.readyState === 1;
  }
}

module.exports = new Database();