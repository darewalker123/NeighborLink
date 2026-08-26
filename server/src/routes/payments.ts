import { Router } from 'express';
import Stripe from 'stripe';
import { PaymentStatus, BookingStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute, ApiError, ok } from '../utils/api.js';
import { notify } from '../services/notifications.js';

const router = Router();
const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
async function recordPaid(bookingId: string, paymentId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { provider: { include: { user: true } } } }); if (!booking) return;
  const feeSetting = await prisma.platformSetting.findUnique({ where: { key: 'platformFeePercent' } }); const feePercent = Number(feeSetting?.value ?? env.PLATFORM_FEE_PERCENT); const amount = Number(booking.quotedPrice); const fee = Number((amount * feePercent / 100).toFixed(2));
  await prisma.$transaction([prisma.payment.upsert({ where: { bookingId }, create: { bookingId, stripePaymentId: paymentId, amount, status: PaymentStatus.PAID, paidAt: new Date() }, update: { stripePaymentId: paymentId, status: PaymentStatus.PAID, paidAt: new Date() } }), prisma.transaction.upsert({ where: { bookingId }, create: { bookingId, grossAmount: amount, platformFee: fee, providerAmount: amount - fee }, update: {} })]);
  await notify(booking.provider.userId, 'Payment received', `Payment for ${booking.id.slice(-6)} was confirmed.`, 'PAYMENT', `/bookings/${bookingId}`); await notify(booking.customerId, 'Payment successful', 'Your payment was confirmed securely.', 'PAYMENT', `/bookings/${bookingId}`);
}
router.post('/bookings/:id/checkout', requireAuth, asyncRoute(async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { service: true, payment: true } }); if (!booking || booking.customerId !== req.auth!.id) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND'); if (booking.status !== BookingStatus.ACCEPTED) throw new ApiError(409, 'The provider needs to accept this booking before payment.', 'PAYMENT_NOT_READY'); if (booking.payment?.status === PaymentStatus.PAID) return ok(res, { alreadyPaid: true }, 'This booking is already paid.');
  await prisma.payment.upsert({ where: { bookingId: booking.id }, create: { bookingId: booking.id, amount: booking.quotedPrice }, update: {} });
  if (!stripe) return ok(res, { demoMode: true, bookingId: booking.id }, 'Stripe is not configured. Use the protected local demo confirmation during development.');
  const session = await stripe.checkout.sessions.create({ mode: 'payment', client_reference_id: booking.id, customer_email: req.auth!.email, success_url: `${env.CLIENT_URL}/bookings/${booking.id}?payment=success`, cancel_url: `${env.CLIENT_URL}/bookings/${booking.id}?payment=cancelled`, line_items: [{ price_data: { currency: 'inr', product_data: { name: booking.service.title }, unit_amount: Math.round(Number(booking.quotedPrice) * 100) }, quantity: 1 }] });
  return ok(res, { checkoutUrl: session.url, sessionId: session.id }, 'Secure Stripe checkout created.');
}));
router.post('/bookings/:id/demo-confirm', requireAuth, asyncRoute(async (req, res) => { if (process.env.NODE_ENV === 'production') throw new ApiError(404, 'Not found.'); const booking = await prisma.booking.findUnique({ where: { id: req.params.id } }); if (!booking || booking.customerId !== req.auth!.id || booking.status !== BookingStatus.ACCEPTED) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND'); await recordPaid(booking.id, `demo_${Date.now()}`); return ok(res, null, 'Development payment confirmation complete.'); }));
export const handleStripeWebhook = async (payload: Buffer, signature?: string) => { if (!stripe || !env.STRIPE_WEBHOOK_SECRET || !signature) throw new ApiError(400, 'Stripe webhook configuration is incomplete.', 'WEBHOOK_INVALID'); const event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET); if (event.type === 'checkout.session.completed') { const session = event.data.object; if (session.payment_status === 'paid' && session.client_reference_id) await recordPaid(session.client_reference_id, String(session.payment_intent)); } return event.type; };
export default router;
