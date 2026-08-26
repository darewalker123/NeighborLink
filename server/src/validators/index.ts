import { z } from 'zod';
export const registerSchema = z.object({ fullName: z.string().trim().min(2).max(80), email: z.string().email(), phone: z.string().trim().min(8).max(20).optional(), password: z.string().min(8).max(100), neighborhood: z.string().trim().min(2).max(80), city: z.string().trim().max(80).optional() });
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const bookingSchema = z.object({ serviceId: z.string().cuid(), scheduledStart: z.coerce.date(), notes: z.string().trim().max(1000).optional(), locationNote: z.string().trim().max(200).optional() });
export const reviewSchema = z.object({ bookingId: z.string().cuid(), rating: z.number().int().min(1).max(5), comment: z.string().trim().min(5).max(1000) });
export const messageSchema = z.object({ body: z.string().trim().min(1).max(2000), attachmentUrl: z.string().url().optional() });
export const disputeSchema = z.object({ bookingId: z.string().cuid(), reason: z.string().trim().min(3).max(120), description: z.string().trim().min(10).max(2000) });
