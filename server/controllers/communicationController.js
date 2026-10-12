import {
    Booking, Message, Notification, ProviderProfile, Report, Service, User
} from '../models/index.js';
import { createNotification } from './notificationHelper.js';
import { createId, httpError } from '../utils/helpers.js';
import { findBooking } from './bookingController.js';

async function userExists(userId) {
    return User.findOne({ _id: userId, isActive: true }).lean();
}

async function sharedBooking(userId, otherUserId) {
    const provider = await ProviderProfile.findOne({ userId }).lean();
    const otherProvider = await ProviderProfile.findOne({ userId: otherUserId }).lean();
    const booking = await Booking.findOne({
        $or: [
            { customerId: userId, providerId: otherProvider?._id },
            { customerId: otherUserId, providerId: provider?._id }
        ]
    }).lean();
    return booking?._id || null;
}

export async function getConversations(request, response) {
    const byUser = new Map();
    const provider = await ProviderProfile.findOne({ userId: request.user.id }).lean();
    const bookingFilter = {
        status: { $in: ['accepted', 'in_progress', 'completed'] },
        $or: [{ customerId: request.user.id }, ...(provider ? [{ providerId: provider._id }] : [])]
    };
    const bookings = await Booking.find(bookingFilter).sort({ updatedAt: -1 }).lean();
    for (const booking of bookings) {
        const participantId = booking.customerId === request.user.id
            ? (await ProviderProfile.findById(booking.providerId).lean())?.userId
            : booking.customerId;
        const other = participantId ? await User.findById(participantId).lean() : null;
        const service = await Service.findById(booking.serviceId).lean();
        if (other && !byUser.has(other._id)) {
            byUser.set(other._id, {
                id: other._id,
                booking: { id: booking._id, service: { title: service?.title } },
                members: [
                    { user: { id: request.user.id, fullName: 'You' } },
                    { user: { id: other._id, fullName: other.fullName, avatarUrl: other.profileImage } }
                ],
                messages: []
            });
        }
    }

    const messages = await Message.find({ $or: [{ senderId: request.user.id }, { receiverId: request.user.id }] }).sort({ createdAt: -1 }).lean();
    for (const message of messages) {
        const otherId = message.senderId === request.user.id ? message.receiverId : message.senderId;
        const other = await User.findById(otherId).lean();
        if (!other) continue;
        if (!byUser.has(otherId)) {
            byUser.set(otherId, {
                id: otherId,
                members: [
                    { user: { id: request.user.id, fullName: 'You' } },
                    { user: { id: otherId, fullName: other.fullName, avatarUrl: other.profileImage } }
                ],
                messages: []
            });
        }
        const conversation = byUser.get(otherId);
        if (!conversation.messages.length) conversation.messages.push({ id: message._id, body: message.message, createdAt: message.createdAt });
    }
    return response.json([...byUser.values()]);
}

export async function getMessages(request, response) {
    const otherUser = await userExists(request.params.id);
    const bookingId = await sharedBooking(request.user.id, request.params.id);
    const hasExisting = await Message.exists({
        $or: [
            { senderId: request.user.id, receiverId: request.params.id },
            { senderId: request.params.id, receiverId: request.user.id }
        ]
    });
    if (!otherUser || (!bookingId && !hasExisting && request.user.role !== 'admin')) {
        throw httpError(403, 'You can message users connected to one of your bookings.');
    }
    const rows = await Message.find({
        $or: [
            { senderId: request.user.id, receiverId: request.params.id },
            { senderId: request.params.id, receiverId: request.user.id }
        ]
    }).sort({ createdAt: 1 }).lean();
    const senders = await User.find({ _id: { $in: rows.map((row) => row.senderId) } }).lean();
    const senderById = new Map(senders.map((sender) => [sender._id, sender]));
    const items = rows.map((row) => {
        const sender = senderById.get(row.senderId);
        return {
            id: row._id,
            body: row.message,
            createdAt: row.createdAt,
            sender: { id: row.senderId, fullName: sender?.fullName, avatarUrl: sender?.profileImage }
        };
    });
    return response.json({ items, pagination: { page: 1, limit: items.length, total: items.length, pages: 1 } });
}

export async function sendMessage(request, response) {
    const messageText = String(request.body.body || request.body.message || '').trim();
    if (!messageText || messageText.length > 2000) throw httpError(422, 'Message must contain between 1 and 2000 characters.');
    const otherUser = await userExists(request.params.id);
    const bookingId = await sharedBooking(request.user.id, request.params.id);
    if (!otherUser || (!bookingId && request.user.role !== 'admin')) throw httpError(403, 'You can message users connected to one of your bookings.');

    const message = await Message.create({ _id: createId(), senderId: request.user.id, receiverId: request.params.id, bookingId, message: messageText });
    const sender = await User.findById(request.user.id).lean();
    await createNotification(request.params.id, 'New message', `${sender.fullName} sent you a message.`, 'message', `/messages/${request.user.id}`);
    return response.status(201).json({
        id: message._id,
        body: message.message,
        createdAt: message.createdAt,
        sender: { id: request.user.id, fullName: sender.fullName, avatarUrl: sender.profileImage }
    });
}

export async function getNotifications(request, response) {
    const rows = await Notification.find({ userId: request.user.id }).sort({ createdAt: -1 }).limit(100).lean();
    return response.json({
        items: rows.map((row) => ({
            id: row._id,
            title: row.title,
            body: row.message,
            type: row.type,
            link: row.link,
            isRead: Boolean(row.isRead),
            createdAt: row.createdAt
        })),
        unread: rows.filter((row) => !row.isRead).length,
        pagination: { page: 1, limit: rows.length, total: rows.length, pages: 1 }
    });
}

export async function markNotificationRead(request, response) {
    await Notification.updateOne({ _id: request.params.id, userId: request.user.id }, { $set: { isRead: true } });
    return response.json({ message: 'Notification marked as read.' });
}

export async function markAllNotificationsRead(request, response) {
    await Notification.updateMany({ userId: request.user.id }, { $set: { isRead: true } });
    return response.json({ message: 'All notifications marked as read.' });
}

export async function createReport(request, response) {
    const { bookingId, reason, description, reportedUserId } = request.body;
    if (!reason || String(reason).trim().length < 3) throw httpError(422, 'Please provide a reason for the report.');
    if (typeof reason !== 'string' || reason.length > 120) throw httpError(422, 'The report reason must be under 120 characters.');
    if (bookingId) {
        const booking = await findBooking(bookingId);
        if (!booking || ![booking.customer.id, booking.provider.user.id].includes(request.user.id)) throw httpError(404, 'Booking not found.');
        const otherUserId = booking.customer.id === request.user.id ? booking.provider.user.id : booking.customer.id;
        if (reportedUserId && reportedUserId !== otherUserId) throw httpError(422, 'The reported user must be the other booking participant.');
    } else if (reportedUserId && !(await userExists(reportedUserId))) {
        throw httpError(404, 'Reported user not found.');
    }
    const report = await Report.create({
        _id: createId(),
        reporterId: request.user.id,
        reportedUserId: reportedUserId || null,
        bookingId: bookingId || null,
        reason: reason.trim(),
        description: description || null
    });
    return response.status(201).json({ id: report._id, message: 'Report submitted for review.' });
}

export async function getOwnReports(request, response) {
    return response.json(await Report.find({ reporterId: request.user.id }).sort({ createdAt: -1 }).lean());
}
