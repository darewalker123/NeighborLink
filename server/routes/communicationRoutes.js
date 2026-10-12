import { Router } from 'express';
import {
    createReport, getConversations, getMessages, getNotifications, getOwnReports,
    markAllNotificationsRead, markNotificationRead, sendMessage
} from '../controllers/communicationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);
router.get('/conversations', asyncHandler(getConversations));
router.get('/conversations/:id/messages', asyncHandler(getMessages));
router.post('/conversations/:id/messages', asyncHandler(sendMessage));
router.get('/notifications', asyncHandler(getNotifications));
router.patch('/notifications/:id/read', asyncHandler(markNotificationRead));
router.post('/notifications/read-all', asyncHandler(markAllNotificationsRead));
router.post('/disputes', asyncHandler(createReport));
router.get('/disputes', asyncHandler(getOwnReports));

export default router;
