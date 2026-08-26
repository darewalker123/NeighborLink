import { Router } from 'express';
import { BookingStatus, PaymentStatus, Role } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncRoute, ApiError, ok } from '../utils/api.js';
import { bookingSchema } from '../validators/index.js';
import { notify } from '../services/notifications.js';
import { isWithinAvailability } from '../services/bookingRules.js';

const router = Router();
const bookingInclude = { service: { include: { category: true } }, customer: { select: { id: true, fullName: true, avatarUrl: true, phone: true, neighborhood: true } }, provider: { include: { user: { select: { id: true, fullName: true, avatarUrl: true, phone: true, neighborhood: true } } } }, payment: true, review: true, conversation: true } as const;
const participant = (b: any, userId: string) => b.customerId === userId || b.provider.userId === userId;
async function assertAvailability(providerId: string, start: Date, end: Date, ignoreId?: string) {
  if (end <= start) throw new ApiError(422, 'The selected end time is invalid.', 'INVALID_TIME');
  const day = start.getDay(); const slot = await prisma.availability.findUnique({ where: { providerId_dayOfWeek: { providerId, dayOfWeek: day } } });
  if (!slot || slot.unavailable || !isWithinAvailability(slot.startTime, slot.endTime, start, end)) throw new ApiError(409, 'The provider is not available at that time.', 'BOOKING_UNAVAILABLE');
  const conflicts = await prisma.booking.count({ where: { providerId, id: ignoreId ? { not: ignoreId } : undefined, status: { in: [BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS] }, scheduledStart: { lt: end }, scheduledEnd: { gt: start } } });
  if (conflicts) throw new ApiError(409, 'This time slot was just booked. Please choose another time.', 'BOOKING_UNAVAILABLE');
}
router.post('/', requireAuth, asyncRoute(async (req, res) => {
  const body = bookingSchema.parse(req.body); const service = await prisma.service.findUnique({ where: { id: body.serviceId }, include: { provider: { include: { user: true, availability: true } } } });
  if (!service || !service.isActive || !service.provider.isAcceptingWork) throw new ApiError(404, 'This service is not currently available.', 'SERVICE_UNAVAILABLE');
  if (service.provider.userId === req.auth!.id) throw new ApiError(422, 'You cannot book your own service.', 'INVALID_BOOKING');
  const end = new Date(body.scheduledStart.getTime() + service.durationMin * 60_000); await assertAvailability(service.providerId, body.scheduledStart, end);
  const booking = await prisma.booking.create({ data: { customerId: req.auth!.id, providerId: service.providerId, serviceId: service.id, scheduledStart: body.scheduledStart, scheduledEnd: end, notes: body.notes, locationNote: body.locationNote, quotedPrice: service.price }, include: bookingInclude });
  await notify(service.provider.userId, 'New booking request', `${booking.customer.fullName} requested ${service.title}.`, 'BOOKING', `/bookings/${booking.id}`);
  return ok(res, booking, 'Booking request sent to the provider.', 201);
}));
router.get('/', requireAuth, asyncRoute(async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1)), limit = Math.min(40, Math.max(1, Number(req.query.limit ?? 12))); const status = req.query.status ? String(req.query.status) as BookingStatus : undefined;
  const where = req.auth!.role === Role.SERVICE_PROVIDER ? { provider: { userId: req.auth!.id }, status } : req.auth!.role === Role.ADMIN ? { status } : { customerId: req.auth!.id, status };
  const [items, total] = await prisma.$transaction([prisma.booking.findMany({ where, include: bookingInclude, orderBy: { scheduledStart: 'desc' }, skip: (page-1)*limit, take: limit }), prisma.booking.count({ where })]);
  return ok(res, { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));
router.get('/:id', requireAuth, asyncRoute(async (req, res) => { const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: bookingInclude }); if (!b || (!participant(b, req.auth!.id) && req.auth!.role !== Role.ADMIN)) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND'); return ok(res, b); }));
router.post('/:id/accept', requireAuth, requireRole(Role.SERVICE_PROVIDER), asyncRoute(async (req, res) => {
  const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: bookingInclude }); if (!b || b.provider.userId !== req.auth!.id) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND'); if (b.status !== BookingStatus.PENDING) throw new ApiError(409, 'Only pending bookings can be accepted.', 'INVALID_STATUS');
  await assertAvailability(b.providerId, b.scheduledStart, b.scheduledEnd, b.id); const updated = await prisma.$transaction(async tx => { const accepted = await tx.booking.update({ where: { id: b.id }, data: { status: BookingStatus.ACCEPTED }, include: bookingInclude }); await tx.conversation.upsert({ where: { bookingId: b.id }, create: { bookingId: b.id, members: { create: [{ userId: b.customerId }, { userId: b.provider.userId }] } }, update: {} }); return accepted; });
  await notify(b.customerId, 'Booking accepted', `${b.provider.user.fullName} accepted your booking. Complete payment to confirm it.`, 'BOOKING', `/bookings/${b.id}`); return ok(res, updated, 'Booking accepted.');
}));
router.post('/:id/reject', requireAuth, requireRole(Role.SERVICE_PROVIDER), asyncRoute(async (req, res) => { const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { provider: true } }); if (!b || b.provider.userId !== req.auth!.id) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND'); if (b.status !== BookingStatus.PENDING) throw new ApiError(409, 'Only pending bookings can be rejected.', 'INVALID_STATUS'); const updated = await prisma.booking.update({ where: { id: b.id }, data: { status: BookingStatus.REJECTED } }); await notify(b.customerId, 'Booking declined', 'The provider was unable to accept this booking request.', 'BOOKING', `/bookings/${b.id}`); return ok(res, updated, 'Booking rejected.'); }));
router.post('/:id/cancel', requireAuth, asyncRoute(async (req, res) => { const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { provider: { include: { user: true } } } }); if (!b || !participant(b, req.auth!.id)) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND'); if (!([BookingStatus.PENDING, BookingStatus.ACCEPTED] as BookingStatus[]).includes(b.status)) throw new ApiError(409, 'This booking can no longer be cancelled.', 'INVALID_STATUS'); const updated = await prisma.booking.update({ where: { id: b.id }, data: { status: BookingStatus.CANCELLED, cancellationAt: new Date(), cancellationBy: req.auth!.id } }); const recipient = b.customerId === req.auth!.id ? b.provider.userId : b.customerId; await notify(recipient, 'Booking cancelled', 'A booking has been cancelled.', 'BOOKING', `/bookings/${b.id}`); return ok(res, updated, 'Booking cancelled.'); }));
router.post('/:id/start', requireAuth, requireRole(Role.SERVICE_PROVIDER), asyncRoute(async (req, res) => { const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { provider: true, payment: true } }); if (!b || b.provider.userId !== req.auth!.id) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND'); if (b.status !== BookingStatus.ACCEPTED || b.payment?.status !== PaymentStatus.PAID) throw new ApiError(409, 'A paid, accepted booking is required to start service.', 'INVALID_STATUS'); return ok(res, await prisma.booking.update({ where: { id: b.id }, data: { status: BookingStatus.IN_PROGRESS } }), 'Service marked as in progress.'); }));
router.post('/:id/complete', requireAuth, requireRole(Role.SERVICE_PROVIDER), asyncRoute(async (req, res) => { const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { provider: true } }); if (!b || b.provider.userId !== req.auth!.id) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND'); if (!([BookingStatus.IN_PROGRESS, BookingStatus.ACCEPTED] as BookingStatus[]).includes(b.status)) throw new ApiError(409, 'This booking cannot be completed now.', 'INVALID_STATUS'); const updated = await prisma.$transaction(async tx => { const booking = await tx.booking.update({ where: { id: b.id }, data: { status: BookingStatus.COMPLETED, completedAt: new Date() } }); await tx.providerProfile.update({ where: { id: b.providerId }, data: { completedJobs: { increment: 1 } } }); return booking; }); await notify(b.customerId, 'Service completed', 'Your provider marked this service as completed. Please leave a review.', 'BOOKING', `/bookings/${b.id}`); return ok(res, updated, 'Service marked as completed.'); }));
export default router;
