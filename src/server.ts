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

    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown...`);

      // Close HTTP server (stop accepting new requests)
      server.close(async () => {
        logger.info('HTTP server closed');

        // Close Socket.io
        io.close(() => {
          logger.info('Socket.io server closed');
        });

        // Close Bull queues
        await closeQueues();

        // Close Redis connections
        await disconnectRedis();

        // Close database connections (handled in config files)
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Start the server
startServer();

