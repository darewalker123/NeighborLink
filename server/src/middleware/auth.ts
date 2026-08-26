import type { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { verifyAccessToken } from '../utils/auth.js';
import { ApiError } from '../utils/api.js';
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try { const header = req.headers.authorization; if (!header?.startsWith('Bearer ')) throw new ApiError(401, 'Authentication required.', 'UNAUTHENTICATED'); req.auth = verifyAccessToken(header.slice(7)); next(); }
  catch (e) { next(e instanceof ApiError ? e : new ApiError(401, 'Your session has expired. Please sign in again.', 'INVALID_TOKEN')); }
}
export const requireRole = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => !req.auth ? next(new ApiError(401, 'Authentication required.')) : roles.includes(req.auth.role) ? next() : next(new ApiError(403, 'You do not have permission to perform this action.', 'FORBIDDEN'));
