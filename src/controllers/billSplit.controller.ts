/**
 * Bill Split Controller
 * 
 * Handles Group Bill Splitting endpoints:
 * - Create/join split sessions
 * - Manage participants
 * - Calculate and confirm shares
 * - Process payments
 */

import { Request, Response } from 'express';
import * as billSplitService from '../services/billSplit.service';
import BillSplit from '../models/BillSplit';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errors';

// ============================================================================
// CREATE SPLIT SESSION
// ============================================================================

/**
 * Create Split Session
 * POST /api/v1/bill-split
 * 
 * @body orderId - The order to split
 * @body splitMethod - 'equal' | 'by_item' | 'by_percentage' | 'custom'
 * @body maxParticipants - Maximum number of participants
 */
export const createSession = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { orderId, splitMethod, maxParticipants } = req.body;

    if (!orderId) {
      throw new ValidationError('Order ID is required');
    }

    const session = await billSplitService.createSplitSession(
      req.user._id.toString(),
      { orderId, splitMethod, maxParticipants }
    );

    logger.info('Split session created', {
      sessionCode: session.sessionCode,
      userId: req.user._id.toString(),
    });

    res.status(201).json({
      success: true,
      data: {
        session: formatSessionResponse(session, req.user._id.toString()),
        shareUrl: session.getShareUrl(),
        message: 'Split session created. Share the code with your friends!',
      },
    });
  } catch (error: any) {
    logger.error('Failed to create split session', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'CREATE_SESSION_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// JOIN SPLIT SESSION
// ============================================================================

/**
 * Join Split Session
 * POST /api/v1/bill-split/join
 * 
 * @body sessionCode - 6-character session code
 */
export const joinSession = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { sessionCode } = req.body;

    if (!sessionCode) {
      throw new ValidationError('Session code is required');
    }

    const session = await billSplitService.joinSplitSession(
      req.user._id.toString(),
      sessionCode
    );

    res.json({
      success: true,
      data: {
        session: formatSessionResponse(session, req.user._id.toString()),
        message: 'Successfully joined the split session!',
      },
    });
  } catch (error: any) {
    logger.error('Failed to join split session', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'JOIN_SESSION_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// GET SESSION BY CODE (Public preview)
// ============================================================================

/**
 * Get Session Preview by Code
 * GET /api/v1/bill-split/code/:code
 * 
 * Public endpoint - shows basic session info for joining
 */
export const getSessionByCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;

    const session = await billSplitService.getSessionByCode(code);

    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Split session not found or expired',
        },
      });
      return;
    }

    // Return limited info for preview
    res.json({
      success: true,
      data: {
        sessionCode: session.sessionCode,
        restaurantName: session.restaurantName,
        tableNumber: session.tableNumber,
        totalAmount: session.totalAmount,
        currency: session.currency,
        splitMethod: session.splitMethod,
        participantCount: session.participants.filter(
          p => !['declined', 'invited'].includes(p.status)
        ).length,
        maxParticipants: session.maxParticipants,
        status: session.status,
        hostName: session.participants.find(p => p.isHost)?.name,
        isExpired: session.expiresAt < new Date(),
        canJoin: ['pending', 'active'].includes(session.status) && 
                 session.expiresAt >= new Date() &&
                 session.participants.length < session.maxParticipants,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get session by code', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_SESSION_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// GET SESSION DETAILS
// ============================================================================

/**
 * Get Session Details
 * GET /api/v1/bill-split/:sessionId
 * 
 * Full session details for participants
 */
export const getSession = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { sessionId } = req.params;

    const session = await billSplitService.getSessionById(
      sessionId,
      req.user._id.toString()
    );

    res.json({
      success: true,
      data: formatSessionResponse(session, req.user._id.toString()),
    });
  } catch (error: any) {
    logger.error('Failed to get session', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_SESSION_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// UPDATE SESSION
// ============================================================================

/**
 * Update Split Session (Host only)
 * PUT /api/v1/bill-split/:sessionId
 * 
 * @body splitMethod - New split method
 * @body maxParticipants - New max participants
 */
export const updateSession = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { sessionId } = req.params;
    const { splitMethod, maxParticipants } = req.body;

    const session = await billSplitService.updateSplitSession(
      sessionId,
      req.user._id.toString(),
      { splitMethod, maxParticipants }
    );

    res.json({
      success: true,
      data: formatSessionResponse(session, req.user._id.toString()),
    });
  } catch (error: any) {
    logger.error('Failed to update session', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'UPDATE_SESSION_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// LEAVE SESSION
// ============================================================================

/**
 * Leave Split Session
 * POST /api/v1/bill-split/:sessionId/leave
 */
export const leaveSession = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { sessionId } = req.params;

    await billSplitService.leaveSplitSession(
      req.user._id.toString(),
      sessionId
    );

    res.json({
      success: true,
      message: 'Left the split session',
    });
  } catch (error: any) {
    logger.error('Failed to leave session', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'LEAVE_SESSION_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// ASSIGN ITEMS
// ============================================================================

/**
 * Assign Items to Participants
 * POST /api/v1/bill-split/:sessionId/assign-items
 * 
 * For by_item split method
 * 
 * @body assignments - Array of { itemId, userIds[] }
 */
export const assignItems = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { sessionId } = req.params;
    const { assignments } = req.body;

    if (!assignments || !Array.isArray(assignments)) {
      throw new ValidationError('Assignments array is required');
    }

    const session = await billSplitService.assignItems(
      sessionId,
      req.user._id.toString(),
      { assignments }
    );

    res.json({
      success: true,
      data: formatSessionResponse(session, req.user._id.toString()),
    });
  } catch (error: any) {
    logger.error('Failed to assign items', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'ASSIGN_ITEMS_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// SET CUSTOM SHARES
// ============================================================================

/**
 * Set Custom Shares (Host only)
 * POST /api/v1/bill-split/:sessionId/set-shares
 * 
 * For percentage/custom split methods
 * 
 * @body shares - Array of { userId, percentage?, amount? }
 */
export const setShares = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { sessionId } = req.params;
    const { shares } = req.body;

    if (!shares || !Array.isArray(shares)) {
      throw new ValidationError('Shares array is required');
    }

    const session = await billSplitService.setCustomShares(
      sessionId,
      req.user._id.toString(),
      { shares }
    );

    res.json({
      success: true,
      data: formatSessionResponse(session, req.user._id.toString()),
    });
  } catch (error: any) {
    logger.error('Failed to set shares', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'SET_SHARES_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// CALCULATE SHARES
// ============================================================================

/**
 * Calculate Shares (Host only)
 * POST /api/v1/bill-split/:sessionId/calculate
 * 
 * Calculates final amounts for all participants
 */
export const calculateShares = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { sessionId } = req.params;

    const session = await billSplitService.calculateShares(
      sessionId,
      req.user._id.toString()
    );

    res.json({
      success: true,
      data: {
        session: formatSessionResponse(session, req.user._id.toString()),
        shares: session.participants
          .filter(p => !['declined', 'invited'].includes(p.status))
          .map(p => ({
            userId: p.userId,
            name: p.name,
            amount: p.calculatedAmount,
            status: p.status,
          })),
      },
    });
  } catch (error: any) {
    logger.error('Failed to calculate shares', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'CALCULATE_SHARES_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// CONFIRM SHARE
// ============================================================================

/**
 * Confirm My Share
 * POST /api/v1/bill-split/:sessionId/confirm
 * 
 * Participant confirms they agree to their share amount
 */
export const confirmShare = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { sessionId } = req.params;

    const session = await billSplitService.confirmShare(
      sessionId,
      req.user._id.toString()
    );

    const myShare = session.participants.find(
      p => p.userId.toString() === req.user!._id.toString()
    );

    res.json({
      success: true,
      data: {
        confirmed: true,
        myShare: myShare?.calculatedAmount,
        allConfirmed: session.status === 'locked',
        message: 'Share confirmed! You can now proceed to payment.',
      },
    });
  } catch (error: any) {
    logger.error('Failed to confirm share', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'CONFIRM_SHARE_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// RECORD PAYMENT
// ============================================================================

/**
 * Record Payment
 * POST /api/v1/bill-split/:sessionId/pay
 * 
 * @body paymentId - Payment reference ID
 * @body amount - Amount paid
 * @body paymentMethod - Payment method used
 */
export const recordPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { sessionId } = req.params;
    const { paymentId, amount, paymentMethod } = req.body;

    if (!paymentId) {
      throw new ValidationError('Payment ID is required');
    }

    if (!amount || amount <= 0) {
      throw new ValidationError('Valid amount is required');
    }

    const session = await billSplitService.recordPayment(
      sessionId,
      req.user._id.toString(),
      paymentId,
      parseFloat(amount),
      paymentMethod || 'phapay'
    );

    const isComplete = session.status === 'completed';

    res.json({
      success: true,
      data: {
        paid: true,
        amountPaid: amount,
        sessionComplete: isComplete,
        message: isComplete 
          ? 'All payments received! Bill split complete.'
          : 'Payment recorded successfully.',
      },
    });
  } catch (error: any) {
    logger.error('Failed to record payment', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'PAYMENT_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// GET ACTIVE SESSIONS
// ============================================================================

/**
 * Get My Active Sessions
 * GET /api/v1/bill-split/active
 */
export const getActiveSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const sessions = await billSplitService.getUserActiveSessions(
      req.user._id.toString()
    );

    res.json({
      success: true,
      data: sessions.map(s => formatSessionResponse(s, req.user!._id.toString())),
    });
  } catch (error: any) {
    logger.error('Failed to get active sessions', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_SESSIONS_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// GET SESSION HISTORY
// ============================================================================

/**
 * Get My Session History
 * GET /api/v1/bill-split/history
 * 
 * @query limit - Number of results
 * @query skip - Pagination offset
 */
export const getSessionHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { limit = '20', skip = '0' } = req.query;

    const result = await billSplitService.getUserSessionHistory(
      req.user._id.toString(),
      {
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
      }
    );

    res.json({
      success: true,
      data: result.data.map(s => formatSessionResponse(s, req.user!._id.toString())),
      pagination: {
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        total: result.total,
        hasMore: parseInt(skip as string) + result.data.length < result.total,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get session history', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_HISTORY_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// CANCEL SESSION
// ============================================================================

/**
 * Cancel Split Session (Host only)
 * DELETE /api/v1/bill-split/:sessionId
 * 
 * @body reason - Optional cancellation reason
 */
export const cancelSession = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { sessionId } = req.params;
    const { reason } = req.body;

    await billSplitService.cancelSession(
      sessionId,
      req.user._id.toString(),
      reason
    );

    res.json({
      success: true,
      message: 'Split session cancelled',
    });
  } catch (error: any) {
    logger.error('Failed to cancel session', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'CANCEL_SESSION_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format session for API response
 */
function formatSessionResponse(session: any, userId: string): any {
  const myParticipant = session.participants.find(
    (p: any) => p.userId.toString() === userId
  );

  return {
    id: session._id,
    sessionCode: session.sessionCode,
    shareUrl: session.getShareUrl ? session.getShareUrl() : null,
    
    // Order info
    orderId: session.orderId,
    restaurantId: session.restaurantId,
    restaurantName: session.restaurantName,
    tableNumber: session.tableNumber,
    
    // Bill details
    subtotal: session.subtotal,
    tax: session.tax,
    serviceCharge: session.serviceCharge,
    discount: session.discount,
    totalAmount: session.totalAmount,
    currency: session.currency,
    
    // Items (for by_item)
    items: session.items?.map((item: any) => ({
      itemId: item.itemId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      assignedTo: item.assignedTo?.map((id: any) => id.toString()),
    })),
    
    // Split config
    splitMethod: session.splitMethod,
    
    // Participants
    participants: session.participants.map((p: any) => ({
      id: p._id,
      oderId: p.joinOrder,
      userId: p.userId,
      name: p.name,
      avatar: p.avatar,
      isHost: p.isHost,
      isMe: p.userId.toString() === userId,
      status: p.status,
      calculatedAmount: p.calculatedAmount,
      paidAmount: p.paidAmount,
      percentage: p.percentage,
      customAmount: p.customAmount,
    })),
    maxParticipants: session.maxParticipants,
    
    // My share
    myShare: myParticipant ? {
      amount: myParticipant.calculatedAmount,
      status: myParticipant.status,
      paid: myParticipant.status === 'paid',
      paidAmount: myParticipant.paidAmount,
    } : null,
    
    // Status
    status: session.status,
    isHost: session.hostId.toString() === userId,
    
    // Timing
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    completedAt: session.completedAt,
    
    // POS sync
    posSyncStatus: session.posSyncStatus,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  createSession,
  joinSession,
  getSessionByCode,
  getSession,
  updateSession,
  leaveSession,
  assignItems,
  setShares,
  calculateShares,
  confirmShare,
  recordPayment,
  getActiveSessions,
  getSessionHistory,
  cancelSession,
};
