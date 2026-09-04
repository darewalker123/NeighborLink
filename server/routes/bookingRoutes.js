import { Router } from 'express';
import {
    acceptBooking, cancelBooking, completeBooking, createBooking,
    getBooking, getBookings, rejectBooking, startBooking
} from '../controllers/bookingController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorizeRole } from '../middleware/roleMiddleware.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);
router.post('/', asyncHandler(createBooking));
router.get('/', asyncHandler(getBookings));
router.get('/:id', asyncHandler(getBooking));
router.post('/:id/accept', authorizeRole('provider'), asyncHandler(acceptBooking));
router.post('/:id/reject', authorizeRole('provider'), asyncHandler(rejectBooking));
router.post('/:id/cancel', asyncHandler(cancelBooking));
router.post('/:id/start', authorizeRole('provider'), asyncHandler(startBooking));
router.post('/:id/complete', authorizeRole('provider'), asyncHandler(completeBooking));

export default router;
