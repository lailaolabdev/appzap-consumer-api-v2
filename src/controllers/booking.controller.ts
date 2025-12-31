// @ts-nocheck
import { Request, Response } from 'express';
import * as posV2Service from '../services/posV2Api.service';
import logger from '../utils/logger';
import { ValidationError, NotFoundError } from '../utils/errors';

// ============================================================================
// TABLE AVAILABILITY
// ============================================================================

/**
 * Get Table Availability
 * GET /api/v1/eats/bookings/availability
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

    const availability = await posV2Service.getTableAvailability(
      restaurantId as string,
      date as string,
      guestsNumber
    );

    res.json({
      restaurantId,
      date,
      guests: guestsNumber,
      availableSlots: availability.slots || [],
      message: availability.message,
    });
  } catch (error: any) {
    logger.error('Failed to get table availability', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_AVAILABILITY_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
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
      specialRequests,
    } = req.body;

    if (!restaurantId || !date || !time || !guests) {
      throw new ValidationError('restaurantId, date, time, and guests are required');
    }

    const guestsNumber = parseInt(guests);
    if (isNaN(guestsNumber) || guestsNumber < 1) {
      throw new ValidationError('guests must be a positive number');
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new ValidationError('date must be in YYYY-MM-DD format');
    }

    // Validate time format (HH:MM)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(time)) {
      throw new ValidationError('time must be in HH:MM format');
    }

    // Create reservation in POS V2
    const reservation = await posV2Service.createReservation({
      restaurantId,
      date,
      time,
      guests: guestsNumber,
      customerId: req.user._id.toString(),
      customerName: customerName || req.user.fullName,
      customerPhone: customerPhone || req.user.phone,
      specialRequests,
      source: 'consumer_app',
    });

    logger.info('Reservation created', {
      reservationId: reservation.id,
      userId: req.user._id.toString(),
      restaurantId,
      date,
      time,
    });

    res.json({
      reservationId: reservation.id,
      restaurantId,
      restaurantName: reservation.restaurantName,
      date,
      time,
      guests: guestsNumber,
      status: reservation.status || 'confirmed',
      confirmationCode: reservation.confirmationCode,
      message: 'Reservation created successfully',
    });
  } catch (error: any) {
    logger.error('Failed to create reservation', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'CREATE_RESERVATION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
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
 */
export const getUserReservations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { status, limit = 20, skip = 0 } = req.query;

    // In a real scenario, we would store reservations in our database
    // For now, we'll proxy to POS V2
    const reservations = await posV2Service.getUserReservations({
      customerId: req.user._id.toString(),
      status,
      limit: parseInt(limit as string),
      skip: parseInt(skip as string),
    });

    res.json({
      data: reservations.data || [],
      pagination: {
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        total: reservations.total || 0,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get user reservations', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_RESERVATIONS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
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

    const reservation = await posV2Service.getReservationById(reservationId);

    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }

    // Verify that reservation belongs to user
    if (reservation.customerId !== req.user._id.toString()) {
      throw new ValidationError('Reservation does not belong to user');
    }

    res.json(reservation);
  } catch (error: any) {
    logger.error('Failed to get reservation details', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_RESERVATION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
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

    // Get reservation to verify ownership
    const reservation = await posV2Service.getReservationById(reservationId);

    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }

    if (reservation.customerId !== req.user._id.toString()) {
      throw new ValidationError('Reservation does not belong to user');
    }

    // Cancel reservation in POS V2
    await posV2Service.cancelReservation(reservationId);

    logger.info('Reservation cancelled', {
      reservationId,
      userId: req.user._id.toString(),
    });

    res.json({
      message: 'Reservation cancelled successfully',
      reservationId,
    });
  } catch (error: any) {
    logger.error('Failed to cancel reservation', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'CANCEL_RESERVATION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

