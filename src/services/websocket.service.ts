import { Server, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisPublisher, redisSubscriber } from '../config/redis';
import * as jwtUtils from '../utils/jwt';
import Order from '../models/Order';
import logger from '../utils/logger';

let io: Server;

/**
 * Initialize Socket.io with Redis adapter
 */
export const initializeWebSocket = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // TODO: Configure proper CORS for production
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Use Redis adapter for horizontal scaling (if Redis is available)
  if (redisPublisher && redisSubscriber) {
    io.adapter(createAdapter(redisPublisher, redisSubscriber));
    logger.info('WebSocket using Redis adapter for scaling');
  } else {
    logger.warn('WebSocket running without Redis adapter (single instance only)');
  }

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = await jwtUtils.verifyAccessToken(token);
      socket.data.userId = decoded.userId;
      socket.data.phone = decoded.phone;

      logger.info('WebSocket client authenticated', {
        socketId: socket.id,
        userId: decoded.userId,
      });

      next();
    } catch (error) {
      logger.error('WebSocket authentication failed', { error });
      next(new Error('Invalid authentication token'));
    }
  });

  // Connection handling
  io.on('connection', (socket: Socket) => {
    logger.info('Client connected', {
      socketId: socket.id,
      userId: socket.data.userId,
    });

    // Join user's personal room
    socket.join(`user:${socket.data.userId}`);

    // Handle joining restaurant rooms (for live bills)
    socket.on('join:restaurant', (restaurantId: string) => {
      socket.join(`restaurant:${restaurantId}`);
      logger.info('Client joined restaurant room', {
        socketId: socket.id,
        userId: socket.data.userId,
        restaurantId,
      });
      socket.emit('joined:restaurant', { restaurantId });
    });

    // Handle leaving restaurant rooms
    socket.on('leave:restaurant', (restaurantId: string) => {
      socket.leave(`restaurant:${restaurantId}`);
      logger.info('Client left restaurant room', {
        socketId: socket.id,
        userId: socket.data.userId,
        restaurantId,
      });
      socket.emit('left:restaurant', { restaurantId });
    });

    // Handle joining order rooms (for order tracking)
    socket.on('join:order', (orderId: string) => {
      socket.join(`order:${orderId}`);
      logger.info('Client joined order room', {
        socketId: socket.id,
        userId: socket.data.userId,
        orderId,
      });
      socket.emit('joined:order', { orderId });
    });

    // Handle leaving order rooms
    socket.on('leave:order', (orderId: string) => {
      socket.leave(`order:${orderId}`);
      logger.info('Client left order room', {
        socketId: socket.id,
        userId: socket.data.userId,
        orderId,
      });
      socket.emit('left:order', { orderId });
    });

    // Handle request for current bill (live bill feature)
    socket.on('request:bill', async (data: { restaurantId: string; tableId?: string }) => {
      try {
        const { restaurantId, tableId } = data;

        // Find active orders for this user at this restaurant
        const orders = await Order.find({
          userId: socket.data.userId,
          restaurantId,
          ...(tableId && { tableId }),
          status: { $in: ['pending', 'confirmed', 'cooking', 'ready', 'served'] },
          paymentStatus: { $ne: 'paid' },
        }).sort({ createdAt: -1 });

        socket.emit('bill:current', {
          restaurantId,
          tableId,
          orders,
          totalAmount: orders.reduce((sum, order) => sum + order.total, 0),
        });

        logger.info('Bill requested', {
          socketId: socket.id,
          userId: socket.data.userId,
          restaurantId,
          tableId,
          orderCount: orders.length,
        });
      } catch (error) {
        logger.error('Failed to fetch bill', { error });
        socket.emit('error', {
          message: 'Failed to fetch bill',
          code: 'BILL_FETCH_FAILED',
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected', {
        socketId: socket.id,
        userId: socket.data.userId,
        reason,
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error', {
        socketId: socket.id,
        userId: socket.data.userId,
        error,
      });
    });
  });

  logger.info('WebSocket server initialized');

  return io;
};

/**
 * Get Socket.io instance
 */
export const getIO = (): Server => {
  if (!io) {
    throw new Error('WebSocket not initialized. Call initializeWebSocket first.');
  }
  return io;
};

// ============================================================================
// EMIT HELPERS
// ============================================================================

/**
 * Emit order update to user
 */
export const emitOrderUpdate = (userId: string, orderId: string, data: any): void => {
  if (io) {
    io.to(`user:${userId}`).emit('order:update', {
      orderId,
      ...data,
    });
    io.to(`order:${orderId}`).emit('order:update', {
      orderId,
      ...data,
    });
    logger.info('Order update emitted', { userId, orderId, data });
  }
};

/**
 * Emit live bill update to restaurant
 */
export const emitBillUpdate = (
  restaurantId: string,
  tableId: string,
  data: any
): void => {
  if (io) {
    io.to(`restaurant:${restaurantId}`).emit('bill:update', {
      restaurantId,
      tableId,
      ...data,
    });
    logger.info('Bill update emitted', { restaurantId, tableId });
  }
};

/**
 * Emit order status change
 */
export const emitOrderStatusChange = (
  userId: string,
  orderId: string,
  newStatus: string,
  data?: any
): void => {
  if (io) {
    io.to(`user:${userId}`).emit('order:status', {
      orderId,
      status: newStatus,
      timestamp: new Date(),
      ...data,
    });
    io.to(`order:${orderId}`).emit('order:status', {
      orderId,
      status: newStatus,
      timestamp: new Date(),
      ...data,
    });
    logger.info('Order status change emitted', { userId, orderId, newStatus });
  }
};

/**
 * Emit new supplement added to order
 */
export const emitSupplementAdded = (
  userId: string,
  orderId: string,
  supplement: any
): void => {
  if (io) {
    io.to(`user:${userId}`).emit('order:supplement', {
      orderId,
      type: 'added',
      supplement,
      timestamp: new Date(),
    });
    io.to(`order:${orderId}`).emit('order:supplement', {
      orderId,
      type: 'added',
      supplement,
      timestamp: new Date(),
    });
    logger.info('Supplement added emitted', { userId, orderId, supplement });
  }
};

/**
 * Emit payment received notification
 */
export const emitPaymentReceived = (userId: string, orderId: string, data: any): void => {
  if (io) {
    io.to(`user:${userId}`).emit('payment:received', {
      orderId,
      ...data,
      timestamp: new Date(),
    });
    logger.info('Payment received emitted', { userId, orderId });
  }
};

/**
 * Emit notification to user
 */
export const emitNotification = (userId: string, notification: any): void => {
  if (io) {
    io.to(`user:${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date(),
    });
    logger.info('Notification emitted', { userId, notification });
  }
};

