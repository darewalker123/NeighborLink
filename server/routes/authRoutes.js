import { Router } from 'express';
import { demoPasswordReset, getCurrentUser, login, register } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();
router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.get('/me', authenticate, asyncHandler(getCurrentUser));
router.post('/logout', authenticate, (_request, response) => response.json({ message: 'Signed out.' }));
router.post('/forgot-password', demoPasswordReset);
router.post('/reset-password', demoPasswordReset);

export default router;
