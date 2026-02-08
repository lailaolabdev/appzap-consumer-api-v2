import http from 'http';
import createApp from './app';
import { connectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { closeQueues } from './config/queue';
import { initializeFirebase } from './config/firebase';
import config from './config/env';
import logger from './utils/logger';
import { initializeWebSocket } from './services/websocket.service';
// Initialize queue workers
import './workers';

/**
 * Start Server
 */
const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDatabase();

      // Connect to Redis
      await connectRedis();

      // Initialize Firebase
      initializeFirebase();

      // Create Express app
      const app = createApp();

    // Create HTTP server
    const server = http.createServer(app);

    // ============================================================================
    // SOCKET.IO SETUP (with Redis Adapter)
    // ============================================================================

    const io = initializeWebSocket(server);

    // Attach io to app for use in controllers
    app.set('io', io);

    // ============================================================================
    // START SERVER
    // ============================================================================

    server.listen(config.port, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 AppZap Consumer API Server Started                  ║
║                                                           ║
║   Environment:  ${config.nodeEnv.padEnd(40)} ║
║   Port:         ${config.port.toString().padEnd(40)} ║
║                                                           ║
║   MongoDB:      ✅ Connected                             ║
║   Redis:        ✅ Connected                             ║
║   Socket.io:    ✅ Enabled (Redis Adapter)               ║
║   Bull Queue:   ✅ Ready                                 ║
║                                                           ║
║   Status:       ✓ Ready to accept connections            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });

    // ============================================================================
    // GRACEFUL SHUTDOWN
    // ============================================================================

    let isShuttingDown = false;

    const gracefulShutdown = async (signal: string) => {
      // Prevent multiple shutdown attempts
      if (isShuttingDown) {
        return;
      }
      isShuttingDown = true;

      logger.info(`${signal} received, starting graceful shutdown...`);

      // Force shutdown after 30 seconds
      const forceShutdownTimeout = setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);

      try {
        // Close HTTP server (stop accepting new requests)
        await new Promise<void>((resolve) => {
          server.close((err) => {
            if (err) {
              logger.warn('HTTP server close error (may already be closed)', { error: err.message });
            } else {
              logger.info('HTTP server closed');
            }
            resolve();
          });
        });

        // Close Socket.io
        try {
          io.close();
          logger.info('Socket.io server closed');
        } catch (ioError: any) {
          logger.warn('Socket.io close error', { error: ioError.message });
        }

        // Close Bull queues
        try {
          await closeQueues();
        } catch (queueError: any) {
          logger.warn('Queue close error', { error: queueError.message });
        }

        // Close Redis connections
        try {
          await disconnectRedis();
        } catch (redisError: any) {
          logger.warn('Redis disconnect error', { error: redisError.message });
        }

        clearTimeout(forceShutdownTimeout);
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error: any) {
        clearTimeout(forceShutdownTimeout);
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors - log but don't shutdown for every rejection
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      if (!isShuttingDown) {
        gracefulShutdown('uncaughtException');
      }
    });

    process.on('unhandledRejection', (reason: any, promise) => {
      // Don't trigger shutdown for ERR_SERVER_NOT_RUNNING as it's usually from shutdown itself
      if (reason?.code === 'ERR_SERVER_NOT_RUNNING') {
        logger.warn('Unhandled rejection during shutdown (expected)', { code: reason.code });
        return;
      }
      logger.error('Unhandled rejection', { reason, promise });
      // Only shutdown for critical unhandled rejections, not during shutdown
      if (!isShuttingDown) {
        gracefulShutdown('unhandledRejection');
      }
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Start the server
startServer();

