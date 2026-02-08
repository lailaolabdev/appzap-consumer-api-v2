import { Router } from 'express';
import * as bookingController from '../controllers/booking.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   GET /api/v1/eats/bookings/availability
 * @desc    Get table availability
 * @access  Public
 * @query   restaurantId, date, guests
 */
router.get('/availability', bookingController.getTableAvailability);

/**
 * @route   POST /api/v1/eats/bookings
 * @desc    Create reservation
 * @access  Private
 * @body    restaurantId, date, time, guests, customerName?, customerPhone?, specialRequests?
 */
router.post('/', authenticate, bookingController.createReservation);

/**
 * @route   GET /api/v1/eats/bookings
 * @desc    Get user reservations
 * @access  Private
 * @query   status?, limit?, skip?
 */
router.get('/', authenticate, bookingController.getUserReservations);

/**
 * @route   GET /api/v1/eats/bookings/:reservationId
 * @desc    Get reservation details
 * @access  Private
 */
router.get('/:reservationId', authenticate, bookingController.getReservationById);

/**
 * @route   PUT /api/v1/eats/bookings/:reservationId
 * @desc    Update reservation
 * @access  Private
 * @body    date?, time?, guests?, specialRequests?
 */
router.put('/:reservationId', authenticate, bookingController.updateReservation);

/**
 * @route   DELETE /api/v1/eats/bookings/:reservationId
 * @desc    Cancel reservation
 * @access  Private
 */
router.delete('/:reservationId', authenticate, bookingController.cancelReservation);

export default router;


