import {
    Availability, Booking, Payment, ProviderProfile, Service, User
} from '../models/index.js';
import { createNotification } from './notificationHelper.js';
import { createId, httpError } from '../utils/helpers.js';
import { buildBooking } from '../utils/mappers.js';

export async function findBooking(id) {
    const booking = await Booking.findById(id).lean();
    return booking ? buildBooking(booking) : null;
}

function canAccessBooking(booking, user) {
    return user.role === 'admin' || booking.customer.id === user.id || booking.provider.user.id === user.id;
}

async function checkAvailability(providerId, scheduledStart, scheduledEnd, ignoredBookingId = null) {
    const startDate = new Date(scheduledStart);
    const dayOfWeek = startDate.getDay();
    const requestedTime = startDate.toTimeString().slice(0, 5);
    const endTime = new Date(scheduledEnd).toTimeString().slice(0, 5);
    const slot = await Availability.findOne({ providerId, dayOfWeek }).lean();
    if (!slot || !slot.isAvailable) throw httpError(409, 'The provider is not available on that day.');
    if (startDate.toDateString() !== new Date(scheduledEnd).toDateString() || requestedTime < slot.startTime || endTime > slot.endTime) {
        throw httpError(409, `Please choose a time between ${slot.startTime} and ${slot.endTime}.`);
    }
    const overlap = await Booking.findOne({
        providerId,
        status: { $in: ['accepted', 'in_progress'] },
        scheduledStart: { $lt: new Date(scheduledEnd) },
        scheduledEnd: { $gt: new Date(scheduledStart) },
        ...(ignoredBookingId ? { _id: { $ne: ignoredBookingId } } : {})
    }).lean();
    if (overlap) throw httpError(409, 'This time slot is already booked. Please choose another time.');
}

export async function createBooking(request, response) {
    const { serviceId, scheduledStart, notes, locationNote } = request.body;
    if (!serviceId || !scheduledStart) throw httpError(422, 'Please choose a service, date and time.');

    const service = await Service.findOne({ _id: serviceId, isActive: true }).lean();
    const provider = service ? await ProviderProfile.findById(service.providerId).lean() : null;
    const providerUser = provider ? await User.findById(provider.userId).lean() : null;
    if (!service || !provider?.isAcceptingWork || !providerUser?.isActive) {
        throw httpError(404, 'This service is not currently available.');
    }
    if (provider.userId === request.user.id) throw httpError(422, 'You cannot book your own service.');

    const start = new Date(scheduledStart);
    if (Number.isNaN(start.getTime()) || start <= new Date()) throw httpError(422, 'Please choose a future booking time.');
    const end = new Date(start.getTime() + service.durationMin * 60_000);
    await checkAvailability(provider._id, start, end);

    const booking = await Booking.create({
        _id: createId(),
        customerId: request.user.id,
        providerId: provider._id,
        serviceId: service._id,
        scheduledStart: start,
        scheduledEnd: end,
        address: locationNote || null,
        notes: notes || null,
        totalAmount: service.price
    });
    await createNotification(provider.userId, 'New booking request', `A customer requested ${service.title}.`, 'booking', `/bookings/${booking._id}`);
    return response.status(201).json(await buildBooking(booking.toObject()));
}

export async function getBookings(request, response) {
    const filter = {};
    if (request.user.role === 'provider') {
        const provider = await ProviderProfile.findOne({ userId: request.user.id }).lean();
        filter.providerId = provider?._id || '__none__';
    } else if (request.user.role === 'customer') {
        filter.customerId = request.user.id;
    }
    if (request.query.status) filter.status = request.query.status;

    const bookings = await Booking.find(filter).sort({ scheduledStart: -1 }).lean();
    const items = await Promise.all(bookings.map((booking) => buildBooking(booking)));
    const page = Math.max(1, Number(request.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(request.query.limit || 20)));
    return response.json({
        items: items.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total: items.length, pages: Math.ceil(items.length / limit) }
    });
}

export async function getBooking(request, response) {
    const booking = await findBooking(request.params.id);
    if (!booking || !canAccessBooking(booking, request.user)) throw httpError(404, 'Booking not found.');
    if (booking.conversation && booking.provider.user.id === request.user.id) booking.conversation.id = booking.customer.id;
    return response.json(booking);
}

async function providerBooking(id, userId) {
    const booking = await findBooking(id);
    if (!booking || booking.provider.user.id !== userId) throw httpError(404, 'Booking not found.');
    return booking;
}

export async function acceptBooking(request, response) {
    const booking = await providerBooking(request.params.id, request.user.id);
    if (booking.status !== 'pending') throw httpError(409, 'Only pending bookings can be accepted.');
    await checkAvailability(booking.provider.id, booking.scheduledStart, booking.scheduledEnd, booking.id);
    const result = await Booking.updateOne(
        { _id: booking.id, status: 'pending' },
        { $set: { status: 'accepted', acceptedAt: new Date() } }
    );
    if (!result.matchedCount) throw httpError(409, 'The booking was already updated. Refresh and try again.');
    await createNotification(booking.customer.id, 'Booking accepted', `${booking.provider.user.fullName} accepted your booking. You can now make the demo payment.`, 'booking', `/bookings/${booking.id}`);
    return response.json(await findBooking(booking.id));
}

export async function rejectBooking(request, response) {
    const booking = await providerBooking(request.params.id, request.user.id);
    if (booking.status !== 'pending') throw httpError(409, 'Only pending bookings can be rejected.');
    await Booking.updateOne({ _id: booking.id, status: 'pending' }, { $set: { status: 'rejected' } });
    await createNotification(booking.customer.id, 'Booking declined', 'The provider declined this request.', 'booking', `/bookings/${booking.id}`);
    return response.json(await findBooking(booking.id));
}

export async function cancelBooking(request, response) {
    const booking = await findBooking(request.params.id);
    if (!booking || !canAccessBooking(booking, request.user) || request.user.role === 'admin') throw httpError(404, 'Booking not found.');
    if (!['pending', 'accepted'].includes(booking.status)) throw httpError(409, 'This booking can no longer be cancelled.');
    const paymentStatus = booking.payment?.status === 'paid' ? 'refunded' : 'pending';
    await Booking.updateOne({ _id: booking.id }, { $set: { status: 'cancelled', cancelledBy: request.user.id, paymentStatus } });
    if (paymentStatus === 'refunded') await Payment.updateOne({ bookingId: booking.id }, { $set: { paymentStatus: 'refunded' } });
    const otherUserId = booking.customer.id === request.user.id ? booking.provider.user.id : booking.customer.id;
    await createNotification(otherUserId, 'Booking cancelled', 'A booking has been cancelled.', 'booking', `/bookings/${booking.id}`);
    return response.json(await findBooking(booking.id));
}

export async function startBooking(request, response) {
    const booking = await providerBooking(request.params.id, request.user.id);
    if (booking.status !== 'accepted' || booking.payment?.status !== 'paid') {
        throw httpError(409, 'The booking must be accepted and paid before service begins.');
    }
    await Booking.updateOne({ _id: booking.id, status: 'accepted', paymentStatus: 'paid' }, { $set: { status: 'in_progress' } });
    await createNotification(booking.customer.id, 'Service started', 'Your provider started the service.', 'booking', `/bookings/${booking.id}`);
    return response.json(await findBooking(booking.id));
}

export async function completeBooking(request, response) {
    const booking = await providerBooking(request.params.id, request.user.id);
    if (booking.status !== 'in_progress') throw httpError(409, 'Only an in-progress booking can be completed.');
    await Booking.updateOne({ _id: booking.id, status: 'in_progress' }, { $set: { status: 'completed', completedAt: new Date() } });
    await ProviderProfile.updateOne({ _id: booking.provider.id }, { $inc: { completedJobs: 1 } });
    await createNotification(booking.customer.id, 'Service completed', 'Please share a review of your experience.', 'booking', `/bookings/${booking.id}`);
    return response.json(await findBooking(booking.id));
}
