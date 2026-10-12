import { Booking, Payment, ProviderProfile, Service, User } from '../models/index.js';
import { createNotification } from './notificationHelper.js';
import { createId, httpError } from '../utils/helpers.js';

export async function makeDemoPayment(request, response) {
    const booking = await Booking.findById(request.params.id).lean();
    const provider = booking ? await ProviderProfile.findById(booking.providerId).lean() : null;
    if (!booking || booking.customerId !== request.user.id) throw httpError(404, 'Booking not found.');
    if (booking.status !== 'accepted') throw httpError(409, 'The provider must accept this booking before payment.');
    if (booking.paymentStatus === 'paid') return response.json({ message: 'This booking is already paid.', alreadyPaid: true });

    const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || 10);
    if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100) throw httpError(500, 'PLATFORM_FEE_PERCENT must be between 0 and 100.');
    const amount = Number(booking.totalAmount);
    const platformFee = Number((amount * feePercent / 100).toFixed(2));
    const providerAmount = Number((amount - platformFee).toFixed(2));

    await Payment.updateOne(
        { bookingId: booking._id },
        {
            $set: { paymentStatus: 'paid', paidAt: new Date(), amount, platformFee, providerAmount },
            $setOnInsert: { _id: createId(), bookingId: booking._id, customerId: booking.customerId, providerId: booking.providerId, paymentMethod: 'demo' }
        },
        { upsert: true }
    );
    await Booking.updateOne({ _id: booking._id }, { $set: { paymentStatus: 'paid' } });
    await createNotification(provider.userId, 'Payment received', `Demo payment of ₹${amount} was recorded.`, 'payment', `/bookings/${booking._id}`);
    await createNotification(booking.customerId, 'Payment successful', 'Your simulated payment was successful.', 'payment', `/bookings/${booking._id}`);
    return response.json({
        message: 'Simulated payment completed successfully.',
        payment: { amount, platformFee, providerAmount, paymentStatus: 'paid' }
    });
}

export async function prepareDemoPayment(request, response) {
    const booking = await Booking.findById(request.params.id).lean();
    if (!booking || booking.customerId !== request.user.id) throw httpError(404, 'Booking not found.');
    if (booking.status !== 'accepted') throw httpError(409, 'The provider must accept this booking before payment.');
    return response.json({ demoMode: true, bookingId: request.params.id });
}

export async function getMyPayments(request, response) {
    const provider = request.user.role === 'provider' ? await ProviderProfile.findOne({ userId: request.user.id }).lean() : null;
    const payments = await Payment.find(request.user.role === 'provider' ? { providerId: provider?._id || '__none__' } : { customerId: request.user.id }).sort({ paidAt: -1 }).lean();
    const rows = [];
    for (const payment of payments) {
        const [booking, service, customer, providerProfile] = await Promise.all([
            Booking.findById(payment.bookingId).lean(),
            Service.findById((await Booking.findById(payment.bookingId).lean())?.serviceId).lean(),
            User.findById(payment.customerId).lean(),
            ProviderProfile.findById(payment.providerId).lean()
        ]);
        const providerUser = providerProfile ? await User.findById(providerProfile.userId).lean() : null;
        rows.push({
            id: payment._id,
            bookingId: payment.bookingId,
            serviceTitle: service?.title || booking?.serviceTitle,
            customerName: customer?.fullName,
            providerName: providerUser?.fullName,
            amount: Number(payment.amount),
            platformFee: Number(payment.platformFee),
            providerAmount: Number(payment.providerAmount),
            paymentStatus: payment.paymentStatus,
            paidAt: payment.paidAt
        });
    }
    return response.json(rows);
}
