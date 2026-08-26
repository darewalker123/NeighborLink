import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/api.js';
export const notFound: RequestHandler = (req, _res, next) => next(new ApiError(404, `Route ${req.method} ${req.path} was not found.`, 'NOT_FOUND'));
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) return res.status(422).json({ success: false, message: 'Please correct the highlighted fields.', errorCode: 'VALIDATION_ERROR', errors: err.flatten() });
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return res.status(409).json({ success: false, message: 'That record already exists.', errorCode: 'DUPLICATE_RECORD' });
  const known = err instanceof ApiError ? err : new ApiError(500, 'Something went wrong. Please try again.', 'INTERNAL_ERROR');
  if (process.env.NODE_ENV !== 'test' && known.status >= 500) console.error(err);
  return res.status(known.status).json({ success: false, message: known.message, errorCode: known.code });
};
