import { Router } from 'express';
import { createReview, getProviderReviews } from '../controllers/reviewController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();
router.post('/reviews', authenticate, asyncHandler(createReview));
router.get('/reviews/provider/:providerId', asyncHandler(getProviderReviews));

export default router;
