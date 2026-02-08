/**
 * Bill Split Service
 * 
 * Handles Group Bill Splitting operations:
 * - Create split sessions
 * - Manage participants
 * - Calculate shares
 * - Process payments
 * - Sync with POS
 */

import BillSplit, { 
  IBillSplit, 
  SplitMethod, 
  SplitSessionStatus,
  IParticipant,
  ISplitItem,
} from '../models/BillSplit';
import User from '../models/User';
import Order from '../models/Order';
import { posRouter } from '../adapters/pos.router';
import logger from '../utils/logger';
import { 
  ValidationError, 
  NotFoundError, 
  BusinessLogicError,
} from '../utils/errors';

// ============================================================================
// CONSTANTS
// ============================================================================

const SESSION_EXPIRY_HOURS = 4;
const MAX_PARTICIPANTS = 10;
const MIN_SPLIT_AMOUNT = 5000; // 5,000 LAK minimum per person

// ============================================================================
// TYPES
// ============================================================================

export interface CreateSplitInput {
  orderId: string;
  splitMethod?: SplitMethod;
  maxParticipants?: number;
}

export interface JoinSplitInput {
  sessionCode: string;
}

export interface UpdateSplitInput {
  splitMethod?: SplitMethod;
  maxParticipants?: number;
}

export interface AssignItemsInput {
  assignments: {
    itemId: string;
    userIds: string[];
  }[];
}

export interface SetCustomSharesInput {
  shares: {
    userId: string;
    amount?: number;
    percentage?: number;
  }[];
}

// ============================================================================
// CREATE SPLIT SESSION
// ============================================================================

/**
 * Create a new bill split session
 */
export const createSplitSession = async (
  hostId: string,
  input: CreateSplitInput
): Promise<IBillSplit> => {
  try {
    // Get host user
    const host = await User.findById(hostId);
    if (!host) {
      throw new NotFoundError('User', hostId);
    }

    // Check for existing active session for this order
    const existingSession = await BillSplit.findOne({
      orderId: input.orderId,
      status: { $nin: ['cancelled', 'completed'] },
    });
    
    if (existingSession) {
      throw new BusinessLogicError(
        'A split session already exists for this order',
        'SESSION_EXISTS'
      );
    }

    // Get order details
    const order = await posRouter.getOrderById(input.orderId);
    if (!order) {
      throw new NotFoundError('Order', input.orderId);
    }

    // Extract POS version and original ID from unified ID
    const posVersion = input.orderId.startsWith('v1_') ? 'v1' : 'v2';
    const posOrderId = input.orderId.replace(/^v[12]_/, '');

    // Prepare items for splitting
    const items: ISplitItem[] = order.items.map((item: any) => ({
      itemId: item.id || item._id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
      assignedTo: [],
    }));

    // Calculate bill amounts
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = order.pricing?.tax || 0;
    const serviceCharge = order.pricing?.serviceCharge || 0;
    const discount = order.pricing?.discount || 0;
    const totalAmount = subtotal + tax + serviceCharge - discount;

    // Create session
    const session = new BillSplit({
      orderId: input.orderId,
      posVersion,
      posOrderId,
      restaurantId: order.restaurantId,
      restaurantName: order.restaurantName || 'Restaurant',
      tableNumber: order.table?.name,
      
      subtotal,
      tax,
      serviceCharge,
      discount,
      totalAmount,
      
      items,
      splitMethod: input.splitMethod || 'equal',
      
      hostId: host._id,
      participants: [{
        joinOrder: 1,
        userId: host._id,
        name: host.fullName || 'Host',
        phone: host.phone,
        isHost: true,
        status: 'joined',
        calculatedAmount: 0,
        paidAmount: 0,
        joinedAt: new Date(),
      }],
      maxParticipants: input.maxParticipants || MAX_PARTICIPANTS,
      
      status: 'pending',
      posSyncStatus: 'pending',
    });

    await session.save();

    logger.info('Bill split session created', {
      sessionCode: session.sessionCode,
      orderId: input.orderId,
      hostId,
      totalAmount,
    });

    return session;
  } catch (error) {
    logger.error('Failed to create split session', { hostId, input, error });
    throw error;
  }
};

// ============================================================================
// JOIN SPLIT SESSION
// ============================================================================

/**
 * Join an existing split session
 */
export const joinSplitSession = async (
  userId: string,
  sessionCode: string
): Promise<IBillSplit> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const session = await BillSplit.findByCode(sessionCode);
    if (!session) {
      throw new NotFoundError('Split session', sessionCode);
    }

    if (session.isExpired) {
      throw new BusinessLogicError('Session has expired', 'SESSION_EXPIRED');
    }

    // Add participant
    await session.addParticipant(
      user._id,
      user.fullName || 'Guest',
      user.phone
    );

    logger.info('User joined split session', {
      sessionCode,
      userId,
    });

    return session;
  } catch (error) {
    logger.error('Failed to join split session', { userId, sessionCode, error });
    throw error;
  }
};

// ============================================================================
// LEAVE SPLIT SESSION
// ============================================================================

/**
 * Leave a split session
 */
export const leaveSplitSession = async (
  userId: string,
  sessionId: string
): Promise<IBillSplit> => {
  try {
    const session = await BillSplit.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Split session', sessionId);
    }

    await session.removeParticipant(userId as any);

    logger.info('User left split session', {
      sessionId,
      userId,
    });

    return session;
  } catch (error) {
    logger.error('Failed to leave split session', { userId, sessionId, error });
    throw error;
  }
};

// ============================================================================
// UPDATE SPLIT METHOD
// ============================================================================

/**
 * Update split session configuration (host only)
 */
export const updateSplitSession = async (
  sessionId: string,
  hostId: string,
  input: UpdateSplitInput
): Promise<IBillSplit> => {
  try {
    const session = await BillSplit.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Split session', sessionId);
    }

    // Verify host
    if (session.hostId.toString() !== hostId) {
      throw new BusinessLogicError('Only host can update session', 'UNAUTHORIZED');
    }

    // Can only update pending/active sessions
    if (!['pending', 'active'].includes(session.status)) {
      throw new BusinessLogicError(
        `Cannot update session with status: ${session.status}`,
        'INVALID_STATUS'
      );
    }

    if (input.splitMethod) {
      session.splitMethod = input.splitMethod;
    }

    if (input.maxParticipants) {
      if (input.maxParticipants < session.participants.length) {
        throw new ValidationError('Max participants cannot be less than current count');
      }
      session.maxParticipants = input.maxParticipants;
    }

    await session.save();

    logger.info('Split session updated', {
      sessionId,
      changes: input,
    });

    return session;
  } catch (error) {
    logger.error('Failed to update split session', { sessionId, input, error });
    throw error;
  }
};

// ============================================================================
// ASSIGN ITEMS (for by_item split)
// ============================================================================

/**
 * Assign items to participants
 */
export const assignItems = async (
  sessionId: string,
  userId: string,
  input: AssignItemsInput
): Promise<IBillSplit> => {
  try {
    const session = await BillSplit.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Split session', sessionId);
    }

    // Verify participant
    const isParticipant = session.participants.some(
      p => p.userId.toString() === userId
    );
    if (!isParticipant) {
      throw new BusinessLogicError('User is not a participant', 'UNAUTHORIZED');
    }

    // Must be by_item method
    if (session.splitMethod !== 'by_item') {
      throw new BusinessLogicError(
        'Item assignment only available for by_item split method',
        'WRONG_METHOD'
      );
    }

    // Update item assignments
    for (const assignment of input.assignments) {
      const item = session.items.find(i => i.itemId === assignment.itemId);
      if (item) {
        item.assignedTo = assignment.userIds.map(id => id as any);
      }
    }

    await session.save();

    logger.info('Items assigned in split session', {
      sessionId,
      assignments: input.assignments.length,
    });

    return session;
  } catch (error) {
    logger.error('Failed to assign items', { sessionId, input, error });
    throw error;
  }
};

// ============================================================================
// SET CUSTOM SHARES
// ============================================================================

/**
 * Set custom shares (for percentage/custom methods)
 */
export const setCustomShares = async (
  sessionId: string,
  hostId: string,
  input: SetCustomSharesInput
): Promise<IBillSplit> => {
  try {
    const session = await BillSplit.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Split session', sessionId);
    }

    // Verify host
    if (session.hostId.toString() !== hostId) {
      throw new BusinessLogicError('Only host can set shares', 'UNAUTHORIZED');
    }

    // Must be percentage or custom method
    if (!['by_percentage', 'custom'].includes(session.splitMethod)) {
      throw new BusinessLogicError(
        'Custom shares only available for percentage/custom methods',
        'WRONG_METHOD'
      );
    }

    // Validate totals
    if (session.splitMethod === 'by_percentage') {
      const totalPercentage = input.shares.reduce((sum, s) => sum + (s.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new ValidationError('Percentages must sum to 100%');
      }
    } else if (session.splitMethod === 'custom') {
      const totalAmount = input.shares.reduce((sum, s) => sum + (s.amount || 0), 0);
      if (Math.abs(totalAmount - session.totalAmount) > 1) {
        throw new ValidationError('Custom amounts must sum to total bill amount');
      }
    }

    // Update participant shares
    for (const share of input.shares) {
      const participant = session.participants.find(
        p => p.userId.toString() === share.userId
      );
      if (participant) {
        if (share.percentage !== undefined) {
          participant.percentage = share.percentage;
        }
        if (share.amount !== undefined) {
          participant.customAmount = share.amount;
        }
      }
    }

    await session.save();

    logger.info('Custom shares set in split session', {
      sessionId,
      shares: input.shares.length,
    });

    return session;
  } catch (error) {
    logger.error('Failed to set custom shares', { sessionId, input, error });
    throw error;
  }
};

// ============================================================================
// CALCULATE SHARES
// ============================================================================

/**
 * Calculate and finalize shares
 */
export const calculateShares = async (
  sessionId: string,
  hostId: string
): Promise<IBillSplit> => {
  try {
    const session = await BillSplit.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Split session', sessionId);
    }

    // Verify host
    if (session.hostId.toString() !== hostId) {
      throw new BusinessLogicError('Only host can calculate shares', 'UNAUTHORIZED');
    }

    // Must have at least 2 active participants
    const activeCount = session.participants.filter(
      p => !['declined', 'invited'].includes(p.status)
    ).length;
    
    if (activeCount < 2) {
      throw new BusinessLogicError(
        'At least 2 participants required to split bill',
        'INSUFFICIENT_PARTICIPANTS'
      );
    }

    await session.calculateShares();

    // Validate minimum amounts
    const belowMinimum = session.participants.filter(
      p => p.calculatedAmount > 0 && p.calculatedAmount < MIN_SPLIT_AMOUNT
    );
    
    if (belowMinimum.length > 0) {
      logger.warn('Some shares below minimum', {
        sessionId,
        belowMinimum: belowMinimum.map(p => ({
          name: p.name,
          amount: p.calculatedAmount,
        })),
      });
    }

    logger.info('Shares calculated', {
      sessionId,
      method: session.splitMethod,
      participants: session.participants.map(p => ({
        name: p.name,
        amount: p.calculatedAmount,
      })),
    });

    return session;
  } catch (error) {
    logger.error('Failed to calculate shares', { sessionId, error });
    throw error;
  }
};

// ============================================================================
// CONFIRM SHARE
// ============================================================================

/**
 * Participant confirms their share
 */
export const confirmShare = async (
  sessionId: string,
  userId: string
): Promise<IBillSplit> => {
  try {
    const session = await BillSplit.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Split session', sessionId);
    }

    await session.confirmParticipant(userId as any);

    logger.info('Share confirmed', {
      sessionId,
      userId,
    });

    return session;
  } catch (error) {
    logger.error('Failed to confirm share', { sessionId, userId, error });
    throw error;
  }
};

// ============================================================================
// PROCESS PAYMENT
// ============================================================================

/**
 * Record payment from participant
 */
export const recordPayment = async (
  sessionId: string,
  userId: string,
  paymentId: string,
  amount: number,
  paymentMethod: string
): Promise<IBillSplit> => {
  try {
    const session = await BillSplit.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Split session', sessionId);
    }

    await session.recordPayment(userId as any, paymentId, amount, paymentMethod);

    // Sync with POS if all paid
    if (session.status === 'completed') {
      await syncWithPOS(session);
    }

    logger.info('Payment recorded', {
      sessionId,
      userId,
      amount,
      paymentMethod,
    });

    return session;
  } catch (error) {
    logger.error('Failed to record payment', { sessionId, userId, error });
    throw error;
  }
};

// ============================================================================
// SYNC WITH POS
// ============================================================================

/**
 * Sync split completion with POS
 */
const syncWithPOS = async (session: IBillSplit): Promise<void> => {
  try {
    if (session.posVersion === 'v2') {
      // POS V2 supports bill splitting
      // Use orderId as billId (in many POS systems they're linked)
      await posRouter.splitBill({
        billId: session.orderId,
        splitType: session.splitMethod === 'by_item' ? 'by_items' : 
                   session.splitMethod === 'custom' ? 'by_amount' : 'equal',
        participants: session.participants
          .filter(p => p.status === 'paid')
          .map(p => ({
            userId: p.userId.toString(),
            name: p.name,
            amount: p.paidAmount,
            items: p.items?.map(i => i.itemId),
          })),
      });
    } else {
      // POS V1 - mark order as paid (doesn't support granular splitting)
      // Just update order status
      logger.info('POS V1 does not support split sync, marking order as paid', {
        sessionId: session._id,
        orderId: session.orderId,
      });
    }

    session.posSyncStatus = 'synced';
    session.posSyncedAt = new Date();
    await session.save();

    logger.info('Split synced with POS', {
      sessionId: session._id,
      posVersion: session.posVersion,
    });
  } catch (error: any) {
    session.posSyncStatus = 'failed';
    session.posSyncError = error.message;
    await session.save();

    logger.error('Failed to sync split with POS', {
      sessionId: session._id,
      error: error.message,
    });
  }
};

// ============================================================================
// GET SESSIONS
// ============================================================================

/**
 * Get split session by ID
 */
export const getSessionById = async (
  sessionId: string,
  userId: string
): Promise<IBillSplit> => {
  try {
    const session = await BillSplit.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Split session', sessionId);
    }

    // Verify access
    const isParticipant = session.participants.some(
      p => p.userId.toString() === userId
    );
    if (!isParticipant) {
      throw new BusinessLogicError('Access denied', 'UNAUTHORIZED');
    }

    return session;
  } catch (error) {
    logger.error('Failed to get session', { sessionId, error });
    throw error;
  }
};

/**
 * Get session by code
 */
export const getSessionByCode = async (
  sessionCode: string
): Promise<IBillSplit | null> => {
  try {
    return await BillSplit.findByCode(sessionCode);
  } catch (error) {
    logger.error('Failed to get session by code', { sessionCode, error });
    throw error;
  }
};

/**
 * Get user's active sessions
 */
export const getUserActiveSessions = async (
  userId: string
): Promise<IBillSplit[]> => {
  try {
    return await BillSplit.findActiveForUser(userId);
  } catch (error) {
    logger.error('Failed to get user sessions', { userId, error });
    throw error;
  }
};

/**
 * Get user's session history
 */
export const getUserSessionHistory = async (
  userId: string,
  params?: { limit?: number; skip?: number }
): Promise<{ data: IBillSplit[]; total: number }> => {
  try {
    const query = {
      $or: [
        { hostId: userId },
        { 'participants.userId': userId },
      ],
      status: { $in: ['completed', 'cancelled'] },
    };

    const [data, total] = await Promise.all([
      BillSplit.find(query)
        .sort({ completedAt: -1, createdAt: -1 })
        .limit(params?.limit || 20)
        .skip(params?.skip || 0),
      BillSplit.countDocuments(query),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Failed to get session history', { userId, error });
    throw error;
  }
};

// ============================================================================
// CANCEL SESSION
// ============================================================================

/**
 * Cancel a split session (host only)
 */
export const cancelSession = async (
  sessionId: string,
  hostId: string,
  reason?: string
): Promise<IBillSplit> => {
  try {
    const session = await BillSplit.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Split session', sessionId);
    }

    // Verify host
    if (session.hostId.toString() !== hostId) {
      throw new BusinessLogicError('Only host can cancel session', 'UNAUTHORIZED');
    }

    // Cannot cancel if payments made
    const hasPaidParticipants = session.participants.some(p => p.status === 'paid');
    if (hasPaidParticipants) {
      throw new BusinessLogicError(
        'Cannot cancel session with completed payments',
        'HAS_PAYMENTS'
      );
    }

    session.status = 'cancelled';
    await session.save();

    logger.info('Split session cancelled', {
      sessionId,
      reason,
    });

    return session;
  } catch (error) {
    logger.error('Failed to cancel session', { sessionId, error });
    throw error;
  }
};

// ============================================================================
// EXPIRE SESSIONS (Cron job)
// ============================================================================

/**
 * Expire old sessions
 */
export const expireSessions = async (): Promise<number> => {
  try {
    const expiredSessions = await BillSplit.findExpiredSessions();
    
    for (const session of expiredSessions) {
      session.status = 'cancelled';
      await session.save();
      
      logger.info('Split session expired', {
        sessionId: session._id,
        sessionCode: session.sessionCode,
      });
    }

    logger.info('Expired sessions processed', { count: expiredSessions.length });
    return expiredSessions.length;
  } catch (error) {
    logger.error('Failed to expire sessions', { error });
    throw error;
  }
};

// ============================================================================
// EXPORT
// ============================================================================

export default {
  createSplitSession,
  joinSplitSession,
  leaveSplitSession,
  updateSplitSession,
  assignItems,
  setCustomShares,
  calculateShares,
  confirmShare,
  recordPayment,
  getSessionById,
  getSessionByCode,
  getUserActiveSessions,
  getUserSessionHistory,
  cancelSession,
  expireSessions,
};
