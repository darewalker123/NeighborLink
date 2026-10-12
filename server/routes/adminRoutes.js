import { Router } from 'express';
import {
    decideVerification, downloadVerification, getOverview, getPayments, getReports,
    getUsers, getVerifications, updateReport, updateUserStatus
} from '../controllers/adminController.js';
import { getBookings } from '../controllers/bookingController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorizeRole } from '../middleware/roleMiddleware.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();
router.use(authenticate, authorizeRole('admin'));
router.get('/overview', asyncHandler(getOverview));
router.get('/stats', asyncHandler(getOverview));
router.get('/users', asyncHandler(getUsers));
router.patch('/users/:id/status', asyncHandler(updateUserStatus));
router.put('/users/:id/status', asyncHandler(updateUserStatus));
router.get('/providers/pending-verification', asyncHandler(getVerifications));
router.get('/verifications', asyncHandler(getVerifications));
router.get('/verifications/:id/document', asyncHandler(downloadVerification));
router.post('/providers/:id/verification', asyncHandler(decideVerification));
router.put('/verifications/:id', asyncHandler(decideVerification));
router.get('/bookings', asyncHandler(getBookings));
router.get('/transactions', asyncHandler(getPayments));
router.get('/payments', asyncHandler(getPayments));
router.get('/disputes', asyncHandler(getReports));
router.get('/reports', asyncHandler(getReports));
router.post('/disputes/:id/resolve', asyncHandler(updateReport));
router.put('/reports/:id', asyncHandler(updateReport));

export default router;
