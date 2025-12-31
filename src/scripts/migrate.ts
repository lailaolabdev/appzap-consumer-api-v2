import mongoose from 'mongoose';
import config from '../config/env';
import logger from '../utils/logger';
import User from '../models/User';
import LoyaltyTransaction from '../models/LoyaltyTransaction';

/**
 * Database Migration Script
 * Run with: npm run migrate
 */

const runMigrations = async (): Promise<void> => {
  try {
    logger.info('Starting database migrations...');

    // Connect to MongoDB
    await mongoose.connect(config.mongodb.uri);
    logger.info('Connected to MongoDB');

    // ============================================================================
    // MIGRATION 1: Create Indexes
    // ============================================================================
    logger.info('Running migration: Create indexes');

    // User indexes
    await User.createIndexes();
    logger.info('✓ User indexes created');

    // LoyaltyTransaction indexes
    await LoyaltyTransaction.createIndexes();
    logger.info('✓ LoyaltyTransaction indexes created');

    // ============================================================================
    // MIGRATION 2: Add default data (if needed)
    // ============================================================================
    // logger.info('Running migration: Add default data');
    // Add your default data here if needed

    // ============================================================================
    // MIGRATION 3: Data transformations (if needed)
    // ============================================================================
    // logger.info('Running migration: Data transformations');
    // Add your data transformations here

    logger.info('✅ All migrations completed successfully');
  } catch (error: any) {
    logger.error('Migration failed', { error: error.message });
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  }
};

// Run migrations
runMigrations();


