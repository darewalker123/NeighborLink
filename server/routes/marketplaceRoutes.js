import { Router } from 'express';
import {
    addFavorite,
    createService,
    deleteService,
    getCategories,
    getFavorites,
    getOwnProviderProfile,
    getProvider,
    getProviders,
    removeFavorite,
    saveAvailability,
    updateProviderProfile,
    updateService
} from '../controllers/marketplaceController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorizeRole } from '../middleware/roleMiddleware.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();
const providerOnly = [authenticate, authorizeRole('provider')];

router.get('/categories', asyncHandler(getCategories));
router.get('/services', asyncHandler(getProviders));
router.get('/providers', asyncHandler(getProviders));
router.get('/providers/me/profile', ...providerOnly, asyncHandler(getOwnProviderProfile));
router.patch('/providers/me', ...providerOnly, asyncHandler(updateProviderProfile));
router.post('/providers/me/services', ...providerOnly, asyncHandler(createService));
router.put('/providers/me/services/:id', ...providerOnly, asyncHandler(updateService));
router.delete('/providers/me/services/:id', ...providerOnly, asyncHandler(deleteService));
router.put('/providers/me/availability', ...providerOnly, asyncHandler(saveAvailability));
router.get('/providers/:id', asyncHandler(getProvider));
router.get('/favorites', authenticate, asyncHandler(getFavorites));
router.post('/favorites/:providerId', authenticate, asyncHandler(addFavorite));
router.delete('/favorites/:providerId', authenticate, asyncHandler(removeFavorite));

export default router;
