import { Router } from 'express';
import { becomeProvider, submitVerification, updateProfile } from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorizeRole } from '../middleware/roleMiddleware.js';
import { uploadVerification } from '../middleware/uploadMiddleware.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();
router.patch('/me', authenticate, asyncHandler(updateProfile));
router.post('/me/become-provider', authenticate, authorizeRole('customer'), asyncHandler(becomeProvider));
router.post(
    '/me/verification',
    authenticate,
    authorizeRole('provider'),
    uploadVerification.single('document'),
    asyncHandler(submitVerification)
);

export default router;
