import type { Response } from 'express';
export class ApiError extends Error { constructor(public status: number, message: string, public code = 'REQUEST_FAILED') { super(message); } }
export const ok = <T>(res: Response, data: T, message = 'Request successful.', status = 200) => res.status(status).json({ success: true, message, data });
export const asyncRoute = <T extends (...args: any[]) => any>(fn: T) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);
