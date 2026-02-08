/**
 * Booking Controller
 * Handles table reservations with support for both POS V1 and POS V2
 * 
 * Features:
 * - Real-time table availability (synced from POS)
 * - Local reservation storage for fast queries
 * - Automatic POS sync
 * - Reminder notifications
 */

import { Request, Response } from 'express';
import { posRouter } from '../adapters/pos.router';
import Reservation, { IReservation } from '../models/Reservation';
import logger from '../utils/logger';
import { ValidationError, NotFoundError, BusinessLogicError } from '../utils/errors';

// ============================================================================
// TABLE AVAILABILITY
// ============================================================================

/**
 * Get Table Availability
 * GET /api/v1/eats/bookings/availability
 * 
 * @query restaurantId - Unified restaurant ID (v1_xxx or v2_xxx)
 * @query date - Date in YYYY-MM-DD format
 * @query guests - Number of guests
 */
export const getTableAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId, date, guests } = req.query;

    if (!restaurantId || !date || !guests) {
      throw new ValidationError('restaurantId, date, and guests are required');
    }

    const guestsNumber = parseInt(guests as string);
    if (isNaN(guestsNumber) || guestsNumber < 1) {
      throw new ValidationError('guests must be a positive number');
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date as string)) {
      throw new ValidationError('date must be in YYYY-MM-DD format');
    }

    // Validate date is not in the past
    const requestedDate = new Date(date as string);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestedDate < today) {
      throw new ValidationError('Cannot check availability for past dates');
    }

    // Use the POS router to get availability from the correct POS system
    const timeSlots = await posRouter.checkAvailability({
      restaurantId: restaurantId as string,
      date: date as string,
      partySize: guestsNumber,
    });

    res.json({
      success: true,
      data: {
        restaurantId,
        date,
        guests: guestsNumber,
        timeSlots: timeSlots.map(slot => ({
          time: slot.time,
          available: slot.available,
          tables: slot.tables,
          maxPartySize: slot.maxPartySize,
          waitTime: slot.waitTime,
        })),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get table availability', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_AVAILABILITY_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// CREATE RESERVATION
// ============================================================================

/**
 * Create Reservation
 * POST /api/v1/eats/bookings
 * 
 * Creates a reservation locally and syncs to the appropriate POS system
 */
export const createReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const {
      restaurantId,
      date,
      time,
      guests,
      customerName,
      customerPhone,
      customerEmail,
      specialRequests,
      duration,
    } = req.body;

    // Validation
    if (!restaurantId || !date || !time || !guests) {
      throw new ValidationError('restaurantId, date, time, and guests are required');
    }

    const guestsNumber = parseInt(guests);
    if (isNaN(guestsNumber) || guestsNumber < 1 || guestsNumber > 50) {
      throw new ValidationError('guests must be between 1 and 50');
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new ValidationError('date must be in YYYY-MM-DD format');
    }

    // Validate time format (HH:mm)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(time)) {
      throw new ValidationError('time must be in HH:mm format');
    }

    // Validate date/time is in the future
    const reservationDateTime = new Date(`${date}T${time}`);
    if (reservationDateTime <= new Date()) {
      throw new ValidationError('Reservation must be in the future');
    }

    // Parse restaurant ID to get POS version
    const { version: posVersion, originalId } = posRouter.parseRestaurantId(restaurantId);
    
    if (!posVersion) {
      throw new ValidationError('Invalid restaurant ID format');
    }

    // Get restaurant details for display
    let restaurantName = '';
    let restaurantImage = '';
    try {
      const restaurant = await posRouter.getRestaurantById(restaurantId);
      if (restaurant) {
        restaurantName = restaurant.name;
        restaurantImage = restaurant.image || '';
      }
    } catch (error) {
      logger.warn('Could not fetch restaurant details', { restaurantId, error });
    }

    // Create local reservation first
    const reservation = new Reservation({
      userId: req.user._id,
      customerName: customerName || req.user.fullName || 'Guest',
      customerPhone: customerPhone || req.user.phone,
      customerEmail: customerEmail || req.user.email,
      restaurantId,
      restaurantName,
      restaurantImage,
      posVersion,
      date,
      time,
      duration: duration || 90,
      guestCount: guestsNumber,
      specialRequests,
      source: 'app',
      status: 'pending',
      posSyncStatus: 'pending',
    });

    await reservation.save();

    // Sync to POS in background (don't block response)
    syncReservationToPOS(reservation).catch(error => {
      logger.error('Background POS sync failed', { reservationId: reservation._id, error });
    });

    logger.info('Reservation created', {
      reservationId: reservation._id,
      reservationCode: reservation.reservationCode,
      userId: req.user._id.toString(),
      restaurantId,
      date,
      time,
    });

    res.status(201).json({
      success: true,
      data: {
        reservationId: reservation._id,
        reservationCode: reservation.reservationCode,
        restaurantId,
        restaurantName,
        date,
        time,
        guests: guestsNumber,
        status: reservation.status,
        message: 'Reservation created successfully',
      },
    });
  } catch (error: any) {
    logger.error('Failed to create reservation', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'CREATE_RESERVATION_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// GET USER RESERVATIONS
// ============================================================================

/**
 * Get User Reservations
 * GET /api/v1/eats/bookings
 * 
 * Returns reservations from local database (fast, reliable)
 */
export const getUserReservations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { status, upcoming, limit = '20', skip = '0' } = req.query;

    // Build query
    const query: any = { userId: req.user._id };

    if (status) {
      query.status = status;
    }

    if (upcoming === 'true') {
      const today = new Date().toISOString().split('T')[0];
      query.date = { $gte: today };
      query.status = { $in: ['pending', 'confirmed'] };
    }

    const [reservations, total] = await Promise.all([
      Reservation.find(query)
        .sort({ date: 1, time: 1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(skip as string))
        .lean(),
      Reservation.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: reservations.map(formatReservationResponse),
      pagination: {
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        total,
        hasMore: parseInt(skip as string) + reservations.length < total,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get user reservations', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_RESERVATIONS_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// GET RESERVATION DETAILS
// ============================================================================

/**
 * Get Reservation Details
 * GET /api/v1/eats/bookings/:reservationId
 */
export const getReservationById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { reservationId } = req.params;

    // Try to find by _id first, then by reservationCode
    let reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      reservation = await Reservation.findOne({ reservationCode: reservationId });
    }

    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }

    // Verify ownership
    if (reservation.userId.toString() !== req.user._id.toString()) {
      throw new BusinessLogicError('Reservation does not belong to user', 'UNAUTHORIZED');
    }

    res.json({
      success: true,
      data: formatReservationResponse(reservation),
    });
  } catch (error: any) {
    logger.error('Failed to get reservation details', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_RESERVATION_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// UPDATE RESERVATION
// ============================================================================

/**
 * Update Reservation
 * PUT /api/v1/eats/bookings/:reservationId
 */
export const updateReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { reservationId } = req.params;
    const { date, time, guests, specialRequests } = req.body;

    const reservation = await Reservation.findById(reservationId);

    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }

    // Verify ownership
    if (reservation.userId.toString() !== req.user._id.toString()) {
      throw new BusinessLogicError('Reservation does not belong to user', 'UNAUTHORIZED');
    }

    // Can only modify pending or confirmed reservations
    if (!['pending', 'confirmed'].includes(reservation.status)) {
      throw new BusinessLogicError(
        'Cannot modify reservation with status: ' + reservation.status,
        'INVALID_STATUS'
      );
    }

    // Update fields
    if (date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        throw new ValidationError('date must be in YYYY-MM-DD format');
      }
      reservation.date = date;
    }

    if (time) {
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(time)) {
        throw new ValidationError('time must be in HH:mm format');
      }
      reservation.time = time;
    }

    if (guests) {
      const guestsNumber = parseInt(guests);
      if (isNaN(guestsNumber) || guestsNumber < 1 || guestsNumber > 50) {
        throw new ValidationError('guests must be between 1 and 50');
      }
      reservation.guestCount = guestsNumber;
    }

    if (specialRequests !== undefined) {
      reservation.specialRequests = specialRequests;
    }

    // Mark for re-sync to POS
    reservation.posSyncStatus = 'pending';
    await reservation.save();

    // Re-sync to POS in background
    syncReservationToPOS(reservation).catch(error => {
      logger.error('Background POS sync failed for update', { reservationId, error });
    });

    logger.info('Reservation updated', {
      reservationId,
      userId: req.user._id.toString(),
    });

    res.json({
      success: true,
      data: formatReservationResponse(reservation),
      message: 'Reservation updated successfully',
    });
  } catch (error: any) {
    logger.error('Failed to update reservation', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'UPDATE_RESERVATION_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// CANCEL RESERVATION
// ============================================================================

/**
 * Cancel Reservation
 * DELETE /api/v1/eats/bookings/:reservationId
 */
export const cancelReservation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { reservationId } = req.params;
    const { reason } = req.body;

    const reservation = await Reservation.findById(reservationId);

    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }

    // Verify ownership
    if (reservation.userId.toString() !== req.user._id.toString()) {
      throw new BusinessLogicError('Reservation does not belong to user', 'UNAUTHORIZED');
    }

    // Can only cancel pending or confirmed reservations
    if (!['pending', 'confirmed'].includes(reservation.status)) {
      throw new BusinessLogicError(
        'Cannot cancel reservation with status: ' + reservation.status,
        'INVALID_STATUS'
      );
    }

    // Cancel locally
    await reservation.cancel(reason);

    // Cancel in POS (if synced)
    if (reservation.posReservationId) {
      try {
        await posRouter.cancelReservation(
          `${reservation.posVersion}_${reservation.posReservationId}`,
          reason
        );
      } catch (error) {
        logger.warn('Failed to cancel reservation in POS', {
          reservationId,
          posReservationId: reservation.posReservationId,
          error,
        });
        // Don't fail the request - local cancellation succeeded
      }
    }

    logger.info('Reservation cancelled', {
      reservationId,
      userId: req.user._id.toString(),
      reason,
    });

    res.json({
      success: true,
      message: 'Reservation cancelled successfully',
      data: {
        reservationId: reservation._id,
        reservationCode: reservation.reservationCode,
        status: 'cancelled',
      },
    });
  } catch (error: any) {
    logger.error('Failed to cancel reservation', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'CANCEL_RESERVATION_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sync reservation to POS system
 */
async function syncReservationToPOS(reservation: IReservation): Promise<void> {
  try {
    // Create reservation in POS
    const posReservation = await posRouter.createReservation({
      restaurantId: reservation.restaurantId,
      date: reservation.date,
      time: reservation.time,
      duration: reservation.duration,
      guestCount: reservation.guestCount,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      customerEmail: reservation.customerEmail,
      specialRequests: reservation.specialRequests,
      source: 'app',
    });

    // Update local record with POS data
    reservation.posReservationId = posReservation.originalId;
    reservation.posSyncStatus = 'synced';
    reservation.posSyncedAt = new Date();
    reservation.posSyncError = undefined;

    // Update status if POS confirmed it
    if (posReservation.status === 'confirmed') {
      reservation.status = 'confirmed';
      reservation.confirmedAt = new Date();
    }

    // Update table info if available
    if (posReservation.tableId) {
      reservation.tableId = posReservation.tableId;
      reservation.tableName = posReservation.tableName;
    }

    await reservation.save();

    logger.info('Reservation synced to POS', {
      reservationId: reservation._id,
      posReservationId: reservation.posReservationId,
    });
  } catch (error: any) {
    // Mark sync as failed but don't throw
    reservation.posSyncStatus = 'failed';
    reservation.posSyncError = error.message;
    await reservation.save();

    logger.error('Failed to sync reservation to POS', {
      reservationId: reservation._id,
      error: error.message,
    });
  }
}

/**
 * Format reservation for API response
 */
function formatReservationResponse(reservation: any): any {
  return {
    id: reservation._id,
    reservationCode: reservation.reservationCode,
    restaurant: {
      id: reservation.restaurantId,
      name: reservation.restaurantName,
      image: reservation.restaurantImage,
    },
    date: reservation.date,
    time: reservation.time,
    endTime: reservation.endTime,
    duration: reservation.duration,
    guestCount: reservation.guestCount,
    status: reservation.status,
    customer: {
      name: reservation.customerName,
      phone: reservation.customerPhone,
      email: reservation.customerEmail,
    },
    table: reservation.tableId
      ? {
          id: reservation.tableId,
          name: reservation.tableName,
          zone: reservation.zone,
        }
      : null,
    specialRequests: reservation.specialRequests,
    deposit: reservation.deposit,
    syncStatus: reservation.posSyncStatus,
    createdAt: reservation.createdAt,
    confirmedAt: reservation.confirmedAt,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  getTableAvailability,
  createReservation,
  getUserReservations,
  getReservationById,
  updateReservation,
  cancelReservation,
};
