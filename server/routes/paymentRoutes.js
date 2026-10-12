import { Router } from 'express';
import { getMyPayments, makeDemoPayment, prepareDemoPayment } from '../controllers/paymentController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);
router.get('/my', asyncHandler(getMyPayments));
router.post('/bookings/:id/checkout', asyncHandler(prepareDemoPayment));
router.post('/bookings/:id/demo-confirm', asyncHandler(makeDemoPayment));
router.post('/:id', asyncHandler(makeDemoPayment));

export default router;
