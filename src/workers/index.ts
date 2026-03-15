/**
 * Queue Workers Initialization
 * Import all workers to start processing jobs
 */

import './subscriptionOrder.worker';
import './supplierSync.worker';
import './notification.worker';

import logger from '../utils/logger';

logger.info('🚀 All queue workers initialized and ready to process jobs');

// Export for cleanup if needed
export * from '../config/queue';


