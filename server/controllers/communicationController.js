import db from '../config/db.js';
import { createNotification } from './notificationHelper.js';
import { createId, httpError } from '../utils/helpers.js';
import { findBooking } from './bookingController.js';

async function userExists(userId) {
    const [users] = await db.query('SELECT id, full_name, profile_image FROM users WHERE id = ? AND is_active = TRUE', [userId]);
    return users[0];
}

async function sharedBooking(userId, otherUserId) {
    const [rows] = await db.query(
        `SELECT b.id FROM bookings b
         JOIN provider_profiles p ON p.id = b.provider_id
         WHERE (b.customer_id = ? AND p.user_id = ?)
            OR (b.customer_id = ? AND p.user_id = ?)
         LIMIT 1`,
        [userId, otherUserId, otherUserId, userId]
    );
    return rows[0]?.id || null;
}

export async function getConversations(request, response) {
    const [messageRows] = await db.query(
        `SELECT m.*,
                other.id AS other_id, other.full_name AS other_name,
                other.profile_image AS other_image
         FROM messages m
         JOIN users other ON other.id = CASE
             WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
         WHERE m.sender_id = ? OR m.receiver_id = ?
         ORDER BY m.created_at DESC`,
        [request.user.id, request.user.id, request.user.id]
    );

    const [bookingRows] = await db.query(
        `SELECT b.id AS booking_id, s.title AS service_title,
                CASE WHEN b.customer_id = ? THEN provider_user.id ELSE customer.id END AS other_id,
                CASE WHEN b.customer_id = ? THEN provider_user.full_name ELSE customer.full_name END AS other_name,
                CASE WHEN b.customer_id = ? THEN provider_user.profile_image ELSE customer.profile_image END AS other_image
         FROM bookings b
         JOIN services s ON s.id = b.service_id
         JOIN users customer ON customer.id = b.customer_id
         JOIN provider_profiles p ON p.id = b.provider_id
         JOIN users provider_user ON provider_user.id = p.user_id
         WHERE (b.customer_id = ? OR p.user_id = ?)
           AND b.status IN ('accepted', 'in_progress', 'completed')
         ORDER BY b.updated_at DESC`,
        [request.user.id, request.user.id, request.user.id, request.user.id, request.user.id]
    );

    const byUser = new Map();
    for (const booking of bookingRows) {
        if (!byUser.has(booking.other_id)) {
            byUser.set(booking.other_id, {
                id: booking.other_id,
                booking: { id: booking.booking_id, service: { title: booking.service_title } },
                members: [
                    { user: { id: request.user.id, fullName: 'You' } },
                    { user: { id: booking.other_id, fullName: booking.other_name, avatarUrl: booking.other_image } }
                ],
                messages: []
            });
        }
    }
    for (const message of messageRows) {
        if (!byUser.has(message.other_id)) {
            byUser.set(message.other_id, {
                id: message.other_id,
                members: [
                    { user: { id: request.user.id, fullName: 'You' } },
                    { user: { id: message.other_id, fullName: message.other_name, avatarUrl: message.other_image } }
                ],
                messages: []
            });
        }
        const conversation = byUser.get(message.other_id);
        if (!conversation.messages.length) {
            conversation.messages.push({
                id: message.id,
                body: message.message,
                createdAt: message.created_at
            });
        }
    }
    return response.json([...byUser.values()]);
}

export async function getMessages(request, response) {
    const otherUser = await userExists(request.params.id);
    const bookingId = await sharedBooking(request.user.id, request.params.id);
    const [existing] = await db.query(
        `SELECT id FROM messages WHERE
         (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) LIMIT 1`,
        [request.user.id, request.params.id, request.params.id, request.user.id]
    );
    if (!otherUser || (!bookingId && !existing.length && request.user.role !== 'admin')) {
        throw httpError(403, 'You can message users connected to one of your bookings.');
    }

    const [rows] = await db.query(
        `SELECT m.*, u.full_name, u.profile_image
         FROM messages m JOIN users u ON u.id = m.sender_id
         WHERE (m.sender_id = ? AND m.receiver_id = ?)
            OR (m.sender_id = ? AND m.receiver_id = ?)
         ORDER BY m.created_at ASC`,
        [request.user.id, request.params.id, request.params.id, request.user.id]
    );
    const items = rows.map((row) => ({
        id: row.id,
        body: row.message,
        createdAt: row.created_at,
        sender: { id: row.sender_id, fullName: row.full_name, avatarUrl: row.profile_image }
    }));
    return response.json({
        items,
        pagination: { page: 1, limit: items.length, total: items.length, pages: 1 }
    });
}

export async function sendMessage(request, response) {
    const messageText = String(request.body.body || request.body.message || '').trim();
    if (!messageText || messageText.length > 2000) {
        throw httpError(422, 'Message must contain between 1 and 2000 characters.');
    }
    const otherUser = await userExists(request.params.id);
    const bookingId = await sharedBooking(request.user.id, request.params.id);
    if (!otherUser || (!bookingId && request.user.role !== 'admin')) {
        throw httpError(403, 'You can message users connected to one of your bookings.');
    }

    const messageId = createId();
    await db.query(
        `INSERT INTO messages (id, sender_id, receiver_id, booking_id, message)
         VALUES (?, ?, ?, ?, ?)`,
        [messageId, request.user.id, request.params.id, bookingId, messageText]
    );
    const [senders] = await db.query('SELECT full_name, profile_image FROM users WHERE id = ?', [request.user.id]);
    await createNotification(request.params.id, 'New message', `${senders[0].full_name} sent you a message.`, 'message', `/messages/${request.user.id}`);
    return response.status(201).json({
        id: messageId,
        body: messageText,
        createdAt: new Date().toISOString(),
        sender: { id: request.user.id, fullName: senders[0].full_name, avatarUrl: senders[0].profile_image }
    });
}

export async function getNotifications(request, response) {
    const [rows] = await db.query(
        `SELECT id, title, message, type, link, is_read, created_at
         FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
        [request.user.id]
    );
    return response.json({
        items: rows.map((row) => ({
            id: row.id,
            title: row.title,
            body: row.message,
            type: row.type,
            link: row.link,
            isRead: Boolean(row.is_read),
            createdAt: row.created_at
        })),
        unread: rows.filter((row) => !row.is_read).length,
        pagination: { page: 1, limit: rows.length, total: rows.length, pages: 1 }
    });
}

export async function markNotificationRead(request, response) {
    await db.query(
        'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
        [request.params.id, request.user.id]
    );
    return response.json({ message: 'Notification marked as read.' });
}

export async function markAllNotificationsRead(request, response) {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [request.user.id]);
    return response.json({ message: 'All notifications marked as read.' });
}

export async function createReport(request, response) {
    const { bookingId, reason, description, reportedUserId } = request.body;
    if (!reason || String(reason).trim().length < 3) {
        throw httpError(422, 'Please provide a reason for the report.');
    }
    if (typeof reason !== 'string' || reason.length > 120) throw httpError(422, 'The report reason must be under 120 characters.');
    if (bookingId) {
        const booking = await findBooking(bookingId);
        if (!booking || ![booking.customer.id, booking.provider.user.id].includes(request.user.id)) {
            throw httpError(404, 'Booking not found.');
        }
        const otherUserId = booking.customer.id === request.user.id ? booking.provider.user.id : booking.customer.id;
        if (reportedUserId && reportedUserId !== otherUserId) throw httpError(422, 'The reported user must be the other booking participant.');
    } else if (reportedUserId && !(await userExists(reportedUserId))) {
        throw httpError(404, 'Reported user not found.');
    }
    const reportId = createId();
    await db.query(
        `INSERT INTO reports
         (id, reporter_id, reported_user_id, booking_id, reason, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [reportId, request.user.id, reportedUserId || null, bookingId || null, reason.trim(), description || null]
    );
    return response.status(201).json({ id: reportId, message: 'Report submitted for review.' });
}

export async function getOwnReports(request, response) {
    const [rows] = await db.query(
        'SELECT * FROM reports WHERE reporter_id = ? ORDER BY created_at DESC',
        [request.user.id]
    );
    return response.json(rows);
}
